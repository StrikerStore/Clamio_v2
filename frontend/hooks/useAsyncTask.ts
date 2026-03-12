'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useAsyncTask — Smart polling hook for PWA background operations.
 *
 * Uses BOTH localStorage (persist across full app close) AND React State (fast UI reactivity).
 *
 * Scenarios handled:
 *  - Stay in app → polls every 2s
 *  - Switch app / lock screen → polling pauses, resumes on return
 *  - Close app + reopen → taskId found in localStorage, polling resumes on mount
 *  - Task expires (>1h) → poll gets 404, user is informed to retry
 */

const STORAGE_KEY = 'claimio_pending_tasks';
const POLL_INTERVAL_MS = 2000;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export interface PendingTask {
    taskId: string;
    type: string;         // 'download-label' | 'refresh' | 'bulk-download-labels' | etc.
    meta?: Record<string, any>;  // e.g. { orderId, format } for UI context
    startedAt: string;
    onComplete?: (result: any) => void;
    onError?: (error: string) => void;
}

interface TaskResult {
    id: string;
    type: string;
    status: 'processing' | 'completed' | 'failed';
    result: any;
    error: string | null;
    createdAt: string;
    completedAt: string | null;
}

function loadFromStorage(): Omit<PendingTask, 'onComplete' | 'onError'>[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveToStorage(tasks: PendingTask[]) {
    if (typeof window === 'undefined') return;
    if (tasks.length === 0) {
        localStorage.removeItem(STORAGE_KEY);
    } else {
        // Strip callbacks before saving (functions can't be JSON-serialised)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(
            tasks.map(t => ({
                taskId: t.taskId,
                type: t.type,
                meta: t.meta,
                startedAt: t.startedAt
            }))
        ));
    }
}

function getAuthHeader(): string {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('authHeader') || localStorage.getItem('vendorToken') || '';
}

interface UseAsyncTaskOptions {
    onComplete?: (taskId: string, result: any) => void;
    onError?: (taskId: string, error: string) => void;
}

export function useAsyncTask(options?: UseAsyncTaskOptions) {
    // activeTasks drives UI indicators (spinner, disabling buttons, etc.)
    const [activeTasks, setActiveTasks] = useState<PendingTask[]>([]);

    // Keeps per-task callbacks in memory so they survive re-renders
    const callbacksRef = useRef<Map<string, { onComplete?: (taskId: string, r: any) => void; onError?: (taskId: string, e: string) => void }>>(new Map());

    // visibilitychange listener dedup refs  
    const visibilityHandlers = useRef<Map<string, () => void>>(new Map());
    const pollTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    // ── Poll for a single task ────────────────────────────────────────────────
    const pollTask = useCallback(async (taskId: string) => {
        const authHeader = getAuthHeader();
        try {
            const res = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
                headers: authHeader ? { Authorization: authHeader } : {}
            });

            if (res.status === 404) {
                // Task expired on backend (>1 hour old)
                const cbs = callbacksRef.current.get(taskId);
                const expiredMsg = 'Task expired. Please retry the operation.';
                if (cbs?.onError) {
                    cbs.onError(taskId, expiredMsg);
                } else {
                    options?.onError?.(taskId, expiredMsg);
                }
                removeTask(taskId);
                return;
            }

            const data = await res.json();
            const task: TaskResult = data.task;

            if (task.status === 'completed') {
                const cbs = callbacksRef.current.get(taskId);
                const result = task.result;
                if (cbs?.onComplete) {
                    cbs.onComplete(taskId, result);
                } else {
                    options?.onComplete?.(taskId, result);
                }
                removeTask(taskId);
                // Tell backend to clean up
                fetch(`${API_BASE_URL}/tasks/${taskId}`, {
                    method: 'DELETE',
                    headers: authHeader ? { Authorization: authHeader } : {}
                }).catch(() => {/* non-critical */ });
            } else if (task.status === 'failed') {
                const cbs = callbacksRef.current.get(taskId);
                const errMsg = task.error || 'Operation failed. Please retry.';
                if (cbs?.onError) {
                    cbs.onError(taskId, errMsg);
                } else {
                    options?.onError?.(taskId, errMsg);
                }
                removeTask(taskId);
            } else {
                // Still processing — schedule next poll
                scheduleNextPoll(taskId);
            }
        } catch {
            // Network hiccup — try again later
            scheduleNextPoll(taskId);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Schedule next poll with visibility awareness ──────────────────────────
    const scheduleNextPoll = useCallback((taskId: string) => {
        // Clear any existing timer/listener for this task
        const existingTimer = pollTimers.current.get(taskId);
        if (existingTimer) clearTimeout(existingTimer);
        const existingHandler = visibilityHandlers.current.get(taskId);
        if (existingHandler) document.removeEventListener('visibilitychange', existingHandler);

        if (document.visibilityState === 'visible') {
            // Normal case: poll after 2 seconds
            const timer = setTimeout(() => pollTask(taskId), POLL_INTERVAL_MS);
            pollTimers.current.set(taskId, timer);
        } else {
            // Tab hidden: pause polling, resume IMMEDIATELY when tab becomes visible
            const handler = () => {
                if (document.visibilityState === 'visible') {
                    document.removeEventListener('visibilitychange', handler);
                    visibilityHandlers.current.delete(taskId);
                    pollTask(taskId);
                }
            };
            document.addEventListener('visibilitychange', handler);
            visibilityHandlers.current.set(taskId, handler);
        }
    }, [pollTask]);

    // ── Add a task and start polling ──────────────────────────────────────────
    const addTask = useCallback((task: PendingTask) => {
        // Save callbacks (not serialisable, keep in memory only)
        callbacksRef.current.set(task.taskId, {
            onComplete: task.onComplete as any,
            onError: task.onError as any
        });

        setActiveTasks(prev => {
            const next = [...prev.filter(t => t.taskId !== task.taskId), task];
            saveToStorage(next);
            return next;
        });

        // Start polling immediately
        pollTask(task.taskId);
    }, [pollTask]);

    // ── Register an already-submitted task by taskId ──────────────────────────
    /**
     * Use this when you've already made the API call and received a taskId.
     * Just registers the taskId for polling + stores optional per-task callbacks.
     */
    const registerTask = useCallback((
        taskId: string,
        onComplete?: (taskId: string, result: any) => void,
        onError?: (taskId: string, error: string) => void,
        type: string = 'unknown'
    ) => {
        const task: PendingTask = {
            taskId,
            type,
            startedAt: new Date().toISOString(),
            onComplete: onComplete as any,
            onError: onError as any
        };
        addTask(task);
    }, [addTask]);

    // ── Remove a task (cleanup) ───────────────────────────────────────────────
    const removeTask = useCallback((taskId: string) => {
        // Clear timer
        const timer = pollTimers.current.get(taskId);
        if (timer) clearTimeout(timer);
        pollTimers.current.delete(taskId);

        // Clear visibility handler
        const handler = visibilityHandlers.current.get(taskId);
        if (handler) document.removeEventListener('visibilitychange', handler);
        visibilityHandlers.current.delete(taskId);

        // Clear callbacks
        callbacksRef.current.delete(taskId);

        // Remove from state + localStorage
        setActiveTasks(prev => {
            const next = prev.filter(t => t.taskId !== taskId);
            saveToStorage(next);
            return next;
        });
    }, []);

    // ── Main API: submit an async task ────────────────────────────────────────
    /**
     * Submit an async task and start polling for its result.
     *
     * @param apiCall  — Function that calls the backend with `async: true`. Must return `{ taskId }`.
     * @param type     — Task type identifier for UI purposes.
     * @param meta     — Extra data to store (orderId, format, etc.) for UI recovery.
     * @param onComplete — Called with the task result when done.
     * @param onError  — Called with error string when failed/expired.
     * @returns taskId
     */
    const submitTask = useCallback(async (
        apiCall: () => Promise<{ taskId?: string; success: boolean;[key: string]: any }>,
        type: string,
        meta: Record<string, any> = {},
        onComplete?: (result: any) => void,
        onError?: (error: string) => void
    ): Promise<string> => {
        const response = await apiCall();

        if (!response.taskId) {
            throw new Error('Backend did not return a taskId. Async mode may not be supported for this operation.');
        }

        const task: PendingTask = {
            taskId: response.taskId,
            type,
            meta,
            startedAt: new Date().toISOString(),
            onComplete,
            onError
        };

        addTask(task);
        return response.taskId;
    }, [addTask]);

    // ── On mount: resume any tasks saved in localStorage ─────────────────────
    useEffect(() => {
        const savedTasks = loadFromStorage();
        if (savedTasks.length > 0) {
            console.log(`📋 useAsyncTask: Found ${savedTasks.length} pending task(s) in localStorage. Resuming polling...`);
            savedTasks.forEach(saved => {
                // Re-add without callbacks (user will need to handle result from state)
                addTask({ ...saved });
            });
        }

        // Cleanup all timers on unmount
        return () => {
            pollTimers.current.forEach(timer => clearTimeout(timer));
            visibilityHandlers.current.forEach((handler) =>
                document.removeEventListener('visibilitychange', handler)
            );
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Helpers ──────────────────────────────────────────────────────────────
    const isTaskActive = useCallback((type: string) =>
        activeTasks.some(t => t.type === type), [activeTasks]);

    const getTaskByMeta = useCallback((key: string, value: any) =>
        activeTasks.find(t => t.meta?.[key] === value), [activeTasks]);

    return {
        submitTask,
        registerTask,
        activeTasks,
        isTaskActive,
        getTaskByMeta,
        removeTask
    };
}
