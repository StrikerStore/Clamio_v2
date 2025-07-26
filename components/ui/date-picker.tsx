"use client"

import * as React from "react"
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay } from "date-fns"
import { Calendar as CalendarIcon, X, ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  date?: Date
  onDateChange?: (date: Date | undefined) => void
  placeholder?: string
  className?: string
}

const CustomCalendar = ({ 
  selected, 
  onSelect, 
  currentMonth, 
  onMonthChange 
}: { 
  selected?: Date
  onSelect?: (date: Date | undefined) => void
  currentMonth: Date
  onMonthChange: (date: Date) => void
}) => {
  const prevMonth = subMonths(currentMonth, 1)
  const nextMonth = addMonths(currentMonth, 1)

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  
  // Get the first day of the week for the month
  const firstDayOfWeek = monthStart.getDay()
  const daysInWeek = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
  
  // Add empty cells for days before the month starts
  const emptyCells = Array.from({ length: firstDayOfWeek }, (_, i) => (
    <div key={`empty-${i}`} className="w-9 h-9" />
  ))

  return (
    <div className="w-full">
      {/* Month Names Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 via-blue-50 to-gray-50">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onMonthChange(prevMonth)}
          className="h-8 w-8 p-0 hover:bg-gray-200 rounded-full"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <div className="flex items-center space-x-6">
          {/* Previous Month Name */}
          <button
            onClick={() => onMonthChange(prevMonth)}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors cursor-pointer font-medium"
          >
            {format(prevMonth, "MMMM")}
          </button>
          
          {/* Current Month Name */}
          <h2 className="text-lg font-bold text-gray-900 px-4 py-1 bg-blue-100 rounded-full">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          
          {/* Next Month Name */}
          <button
            onClick={() => onMonthChange(nextMonth)}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors cursor-pointer font-medium"
          >
            {format(nextMonth, "MMMM")}
          </button>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onMonthChange(nextMonth)}
          className="h-8 w-8 p-0 hover:bg-gray-200 rounded-full"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Single Month Calendar */}
      <div className="p-4 bg-white">
        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-1 mb-3">
          {daysInWeek.map((day) => (
            <div 
              key={day} 
              className="text-center text-xs font-semibold text-gray-600 w-9 h-7 flex items-center justify-center"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {emptyCells}
          {days.map((day) => {
            const isSelected = selected && isSameDay(day, selected)
            const isTodayDate = isToday(day)
            
            return (
              <button
                key={day.toISOString()}
                onClick={() => onSelect?.(day)}
                className={cn(
                  "w-9 h-9 text-sm rounded-lg transition-all duration-200 flex items-center justify-center font-medium hover:scale-105 hover:shadow-md",
                  "text-gray-700 hover:bg-blue-100",
                  isSelected
                    ? "bg-blue-600 text-white hover:bg-blue-700 shadow-lg scale-105"
                    : "",
                  isTodayDate && !isSelected
                    ? "bg-blue-50 text-blue-700 font-bold border-2 border-blue-300"
                    : ""
                )}
              >
                {format(day, "d")}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function DatePicker({
  date,
  onDateChange,
  placeholder = "Pick a date",
  className
}: DatePickerProps) {
  const [currentMonth, setCurrentMonth] = React.useState(date || new Date())

  const handleTodayClick = () => {
    const today = new Date()
    onDateChange?.(today)
    setCurrentMonth(today)
  }

  const handleClearClick = () => {
    onDateChange?.(undefined)
  }

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      onDateChange?.(selectedDate)
      setCurrentMonth(selectedDate)
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal cursor-pointer hover:bg-gray-50 transition-colors",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-3 h-4 w-4 text-gray-500" />
          {date ? (
            <span className="text-gray-900">{format(date, "MMM dd, yyyy")}</span>
          ) : (
            <span className="text-gray-500">{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 shadow-xl border border-gray-200 rounded-lg overflow-hidden" align="start">
        {/* Quick Actions */}
        <div className="p-3 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-blue-50">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTodayClick}
              className="flex-1 text-xs h-8 bg-white hover:bg-blue-50 hover:text-blue-600 border-gray-200 transition-colors"
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearClick}
              className="flex-1 text-xs h-8 bg-white hover:bg-red-50 hover:text-red-600 border-gray-200 transition-colors"
            >
              <X className="w-3 h-3 mr-1" />
              Clear
            </Button>
          </div>
        </div>
        
        {/* Custom Calendar */}
        <CustomCalendar
          selected={date}
          onSelect={handleDateSelect}
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
        />
      </PopoverContent>
    </Popover>
  )
} 