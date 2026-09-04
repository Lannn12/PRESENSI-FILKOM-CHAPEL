import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats student name consistently as "Last, First"
 * @param firstName - Student's first name
 * @param lastName - Student's last name
 * @returns Formatted name string "Last, First"
 */
export function formatStudentName(firstName: string, lastName: string): string {
  return `${lastName}, ${firstName}`
}

/**
 * Formats student full name for search/filter purposes (no comma)
 * @param firstName - Student's first name
 * @param lastName - Student's last name
 * @returns Full name string "Last First" for searching
 */
export function formatStudentNameForSearch(firstName: string, lastName: string): string {
  return `${lastName} ${firstName}`
}
