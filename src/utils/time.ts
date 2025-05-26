export const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('de-DE', { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Europe/Berlin'
  });
};

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', {
    timeZone: 'Europe/Berlin'
  });
};

export const calculateDuration = (start: string, end?: string): string => {
  const startTime = new Date(start).getTime();
  const endTime = end ? new Date(end).getTime() : Date.now();
  
  const diff = endTime - startTime;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export const calculateTotalWorkTime = (entry: { startTime: string; endTime?: string; breaks: { startTime: string; endTime?: string }[] }): string => {
  const totalBreakTime = entry.breaks.reduce((acc, breakItem) => {
    if (breakItem.endTime) {
      return acc + (new Date(breakItem.endTime).getTime() - new Date(breakItem.startTime).getTime());
    }
    return acc;
  }, 0);
  
  const workStart = new Date(entry.startTime).getTime();
  const workEnd = entry.endTime ? new Date(entry.endTime).getTime() : Date.now();
  const totalTime = workEnd - workStart - totalBreakTime;
  
  const hours = Math.floor(totalTime / (1000 * 60 * 60));
  const minutes = Math.floor((totalTime % (1000 * 60 * 60)) / (1000 * 60));
  
  return `${hours}h ${minutes}min`;
};