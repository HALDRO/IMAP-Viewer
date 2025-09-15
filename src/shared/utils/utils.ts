/**
 * @file Utility functions for ShadCN UI components and general use
 */
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Combines class names using clsx and tailwind-merge for optimal Tailwind CSS class handling
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
