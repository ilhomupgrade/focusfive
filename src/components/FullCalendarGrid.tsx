import React from 'react';

type FullCalendarGridProps = {
  currentMonth: Date;
}

const FullCalendarGrid: React.FC<FullCalendarGridProps> = ({ currentMonth }) => {
  // Days of the week headers
  const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  
  // Generate calendar days for the current view
  // For this example, we're using fixed data to match the image
  const calendarData = [
    [23, 24, 25, 26, 27, 28, 1],
    [2, 3, 4, 5, 6, 7, 8],
    [9, 10, 11, 12, 13, 14, 15],
    [16, 17, 18, 19, 20, 21, 22],
    [23, 24, 25, 26, 27, 28, 29],
    [30, 31, 1, 2, 3, 4, 5],
  ];

  return (
    <div className="w-full h-full grid grid-cols-7 grid-rows-6">
      {calendarData.flat().map((day, index) => {
        const rowIndex = Math.floor(index / 7);
        const colIndex = index % 7;
        
        return (
          <div 
            key={`${rowIndex}-${colIndex}-${day}`}
            className="border-t border-l border-neutral-800 relative"
          >
            <div className="absolute top-2 left-2 text-sm">
              {day}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FullCalendarGrid;