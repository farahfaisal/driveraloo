export function formatDate(dateString: string, options: Intl.DateTimeFormatOptions = {}): string {
  const date = new Date(dateString);
  
  // Format date in Arabic locale with Gregorian calendar
  return date.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
    calendar: 'gregory', // Explicitly use Gregorian calendar
    numberingSystem: 'latn' // Use Latin numerals instead of Arabic
  });
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  
  // Format date in Arabic locale with Gregorian calendar
  return date.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    calendar: 'gregory', // Explicitly use Gregorian calendar
    numberingSystem: 'latn' // Use Latin numerals instead of Arabic
  });
}

export function formatTime(dateString: string): string {
  const date = new Date(dateString);
  
  // Format time in Arabic locale
  return date.toLocaleTimeString('ar-SA', {
    hour: '2-digit',
    minute: '2-digit',
    numberingSystem: 'latn' // Use Latin numerals instead of Arabic
  });
}