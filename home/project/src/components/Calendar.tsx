import React, { useState, useEffect } from 'react';
import { format, addDays, subDays, startOfWeek, getDay, addWeeks, subWeeks, 
  startOfMonth, endOfMonth, getMonth, getYear, setMonth, addMonths, subMonths,
  isSameMonth, isToday, parseISO, isSameDay, isSameWeek, getISOWeek } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Settings, Calendar as CalendarIcon, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Task = {
  id: string;
  text: string;
  completed: boolean;
  cellIndex: number; // Track which cell this task belongs to
};

type DayTasks = {
  [dateKey: string]: Task[];
};

type CalendarProps = {
  month?: Date;
}

type ViewMode = 'week' | 'month';

// Russian day abbreviations
const RUSSIAN_DAYS = ['ПН.', 'ВТ.', 'СР.', 'ЧТ.', 'ПТ.', 'СБ.', 'ВС.'];
// Russian month names
const RUSSIAN_MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const Calendar: React.FC<CalendarProps> = ({ month = new Date() }) => {
  // Current view settings
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [showMonthSelector, setShowMonthSelector] = useState(false);
  const [focusModeEnabled, setFocusModeEnabled] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Generate week days based on current date
  const [weekDays, setWeekDays] = useState<Date[]>([]);
  // Generate month days for month view
  const [monthDays, setMonthDays] = useState<Date[][]>([]);
  
  // Tasks state
  const [tasks, setTasks] = useState<DayTasks>({});
  const [newTaskText, setNewTaskText] = useState<{ [key: string]: string }>({});
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Get user ID on component mount
  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          console.error('Error getting user:', userError);
          setErrorMessage('Ошибка при получении данных пользователя');
          setIsLoading(false);
          return;
        }

        setUserId(user?.id || null);

        if (user) {
          try {
            // Load user settings
            const { data: settings, error: settingsError } = await supabase
              .from('user_settings')
              .select('*')
              .eq('user_id', user.id)
              .single();

            if (settingsError && settingsError.code !== 'PGRST116') { // Not found error code
              console.error('Error fetching settings:', settingsError);
            }

            if (settings) {
              setViewMode(settings.view_mode as ViewMode);
              setFocusModeEnabled(settings.focus_mode);
            } else {
              // Create default settings if none exist
              try {
                await supabase.from('user_settings').insert({
                  user_id: user.id,
                  view_mode: 'week',
                  focus_mode: false
                });
              } catch (insertError) {
                console.error('Error creating settings:', insertError);
              }
            }

            // Load user tasks
            await fetchTasks(user.id);
          } catch (error) {
            console.error('Error in user data handling:', error);
            setErrorMessage('Ошибка при загрузке настроек пользователя');
          }
        }
        setIsLoading(false);
      } catch (error) {
        console.error('Fatal error in user authentication:', error);
        setErrorMessage('Критическая ошибка аутентификации');
        setIsLoading(false);
      }
    };

    getUser();
  }, []);

  // Fetch tasks from Supabase
  const fetchTasks = async (userId: string) => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching tasks:', error);
        setErrorMessage('Ошибка при загрузке задач');
        setTimeout(() => setErrorMessage(null), 3000);
      } else if (data) {
        // Convert to DayTasks format
        const dayTasks: DayTasks = {};
        
        data.forEach(task => {
          const dateKey = task.date_key;
          
          if (!dayTasks[dateKey]) {
            dayTasks[dateKey] = [];
          }
          
          dayTasks[dateKey].push({
            id: task.id,
            text: task.text,
            completed: task.completed,
            cellIndex: task.cell_index
          });
        });
        
        setTasks(dayTasks);
      }
    } catch (error) {
      console.error('Unexpected error fetching tasks:', error);
      setErrorMessage('Непредвиденная ошибка при загрузке задач');
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  // Update week days when current date changes
  useEffect(() => {
    generateWeekDays();
    generateMonthDays();
  }, [currentDate]);

  // Generate array of dates for the current week
  const generateWeekDays = () => {
    let startDay = startOfWeek(currentDate, { weekStartsOn: 1 }); // Start on Monday
    let days = [];
    
    for (let i = 0; i < 7; i++) {
      days.push(addDays(startDay, i));
    }
    
    setWeekDays(days);
  };

  // Generate array of dates for the current month view - exactly 5 rows
  const generateMonthDays = () => {
    // Get the first day of the month
    const monthStart = startOfMonth(currentDate);
    // Get the first day of the first week (might be from previous month)
    const startDay = startOfWeek(monthStart, { weekStartsOn: 1 });
    
    // Create 5 weeks (35 days total)
    const weeks: Date[][] = [];
    
    for (let row = 0; row < 5; row++) {
      const week: Date[] = [];
      for (let col = 0; col < 7; col++) {
        const day = addDays(startDay, row * 7 + col);
        week.push(day);
      }
      weeks.push(week);
    }
    
    setMonthDays(weeks);
  };

  // Save user settings to Supabase
  const saveUserSettings = async () => {
    if (!userId) return;
    
    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: userId,
          view_mode: viewMode,
          focus_mode: focusModeEnabled
        });

      if (error) {
        console.error('Error saving user settings:', error);
        setErrorMessage('Ошибка при сохранении настроек');
        setTimeout(() => setErrorMessage(null), 3000);
      }
    } catch (error) {
      console.error('Unexpected error saving settings:', error);
    }
  };

  // Get the ISO week number for the current date
  const getCurrentWeekNumber = (): number => {
    return getISOWeek(currentDate);
  };

  // Toggle focus mode
  const toggleFocusMode = () => {
    const newValue = !focusModeEnabled;
    setFocusModeEnabled(newValue);
    
    // Save to database
    if (userId) {
      supabase
        .from('user_settings')
        .upsert({
          user_id: userId,
          focus_mode: newValue
        })
        .then(({ error }) => {
          if (error) {
            console.error('Error saving focus mode:', error);
          }
        });
    }
  };

  // Check if a date is in the current week
  const isCurrentWeek = (date: Date) => {
    return isSameWeek(date, currentDate, { weekStartsOn: 1 });
  };

  // Navigation functions
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const goToPrevWeek = () => {
    setCurrentDate(subWeeks(currentDate, 1));
  };

  const goToNextWeek = () => {
    setCurrentDate(addWeeks(currentDate, 1));
  };

  const goToPrevMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  const changeMonth = (monthIndex: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(monthIndex);
    setCurrentDate(newDate);
    setShowMonthSelector(false);
  };

  const navigatePrevious = () => {
    if (viewMode === 'week') {
      goToPrevWeek();
    } else {
      goToPrevMonth();
    }
  };

  const navigateNext = () => {
    if (viewMode === 'week') {
      goToNextWeek();
    } else {
      goToNextMonth();
    }
  };

  // Toggle between week and month view
  const toggleViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    
    // Save to database
    if (userId) {
      supabase
        .from('user_settings')
        .upsert({
          user_id: userId,
          view_mode: mode
        })
        .then(({ error }) => {
          if (error) {
            console.error('Error saving view mode:', error);
          }
        });
    }
  };

  // Format date helpers
  const formatDateKey = (date: Date): string => {
    return format(date, 'yyyy-MM-dd');
  };

  // Generate a unique ID
  const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  };

  // Get occupied cells for a day
  const getOccupiedCells = (dateKey: string): number[] => {
    return (tasks[dateKey] || []).map(task => task.cellIndex);
  };

  // Find the first available cell index
  const getFirstAvailableCellIndex = (dateKey: string): number | null => {
    const occupiedCells = getOccupiedCells(dateKey);
    for (let i = 0; i < 5; i++) {
      if (!occupiedCells.includes(i)) {
        return i;
      }
    }
    return null; // No available cells
  };

  // Add a task for a specific date
  const addTask = async (dateKey: string) => {
    if (!newTaskText[dateKey]?.trim() || !userId) return;
    
    const availableCellIndex = getFirstAvailableCellIndex(dateKey);
    
    // No available cells
    if (availableCellIndex === null) {
      setErrorMessage("Максимум 5 задач на день");
      
      // Clear error after 3 seconds
      setTimeout(() => {
        setErrorMessage(null);
      }, 3000);
      
      return;
    }
    
    // Generate an ID for the client-side first
    const clientId = generateId();
    
    // Create a new task object
    const newTask: Task = {
      id: clientId,
      text: newTaskText[dateKey],
      completed: false,
      cellIndex: availableCellIndex
    };
    
    // Optimistically update UI
    setTasks({
      ...tasks,
      [dateKey]: [...(tasks[dateKey] || []), newTask],
    });
    
    // Clear input
    const updatedNewTaskText = { ...newTaskText };
    updatedNewTaskText[dateKey] = '';
    setNewTaskText(updatedNewTaskText);
    setEditingCell(null);
    
    // Save to database
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id: userId,
          text: newTask.text,
          completed: newTask.completed,
          date_key: dateKey,
          cell_index: newTask.cellIndex
        })
        .select();
      
      if (error) throw error;
      
      // Update task with server-generated ID
      if (data && data[0]) {
        setTasks(prev => {
          const dayTasks = [...(prev[dateKey] || [])];
          const taskIndex = dayTasks.findIndex(t => t.id === clientId);
          
          if (taskIndex !== -1) {
            dayTasks[taskIndex] = {
              ...dayTasks[taskIndex],
              id: data[0].id
            };
          }
          
          return {
            ...prev,
            [dateKey]: dayTasks
          };
        });
      }
    } catch (error) {
      console.error('Error saving task:', error);
      
      // Revert optimistic update
      setTasks(prev => {
        const dayTasks = [...(prev[dateKey] || [])];
        return {
          ...prev,
          [dateKey]: dayTasks.filter(t => t.id !== clientId)
        };
      });
      
      setErrorMessage("Ошибка при сохранении задачи");
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  // Remove a task
  const removeTask = async (dateKey: string, taskId: string) => {
    // Optimistically update UI
    const currentTasks = tasks[dateKey] || [];
    setTasks({
      ...tasks,
      [dateKey]: currentTasks.filter(task => task.id !== taskId),
    });
    
    // Remove from database
    if (userId) {
      try {
        const { error } = await supabase
          .from('tasks')
          .delete()
          .eq('id', taskId)
          .eq('user_id', userId);
        
        if (error) throw error;
      } catch (error) {
        console.error('Error removing task:', error);
        
        // Revert optimistic update
        setTasks({
          ...tasks,
          [dateKey]: currentTasks,
        });
        
        setErrorMessage("Ошибка при удалении задачи");
        setTimeout(() => setErrorMessage(null), 3000);
      }
    }
  };

  // Toggle task completion
  const toggleTaskCompletion = async (dateKey: string, taskId: string) => {
    const currentTasks = tasks[dateKey] || [];
    const taskToUpdate = currentTasks.find(task => task.id === taskId);
    
    if (!taskToUpdate || !userId) return;
    
    // New completed state
    const newCompletedState = !taskToUpdate.completed;
    
    // Optimistically update UI
    setTasks({
      ...tasks,
      [dateKey]: currentTasks.map(task => 
        task.id === taskId ? { ...task, completed: newCompletedState } : task
      ),
    });
    
    // Update in database
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ completed: newCompletedState })
        .eq('id', taskId)
        .eq('user_id', userId);
      
      if (error) throw error;
    } catch (error) {
      console.error('Error updating task:', error);
      
      // Revert optimistic update
      setTasks({
        ...tasks,
        [dateKey]: currentTasks,
      });
      
      setErrorMessage("Ошибка при обновлении задачи");
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  // Handle input change for new task
  const handleInputChange = (dateKey: string, value: string) => {
    setNewTaskText({
      ...newTaskText,
      [dateKey]: value,
    });
  };

  // Keypress handler for adding tasks
  const handleKeyPress = (e: React.KeyboardEvent, dateKey: string) => {
    if (e.key === 'Enter') {
      addTask(dateKey);
    }
  };

  // Get task for specific cell (if any)
  const getTaskForCell = (dateKey: string, cellIndex: number): Task | null => {
    const dayTasks = tasks[dateKey] || [];
    return dayTasks.find(task => task.cellIndex === cellIndex) || null;
  };

  // Get all tasks for a specific date
  const getTasksForDate = (date: Date): Task[] => {
    const dateKey = formatDateKey(date);
    return tasks[dateKey] || [];
  };

  // Calculate statistics for the current week or month
  const getStats = () => {
    const allTasks: Task[] = [];
    let dateRange: Date[] = [];
    
    // Collect all tasks for the current view
    if (viewMode === 'week') {
      dateRange = weekDays;
    } else {
      // Flatten month days
      dateRange = monthDays.flat().filter(date => isSameMonth(date, currentDate));
    }
    
    // Add weekly goals if in week view
    if (viewMode === 'week') {
      const weeklyTasks = tasks[weeklyGoalKey] || [];
      allTasks.push(...weeklyTasks);
    }
    
    // Get tasks for each date in the range
    dateRange.forEach(date => {
      const dateKey = formatDateKey(date);
      const dateTasks = tasks[dateKey] || [];
      allTasks.push(...dateTasks);
    });
    
    // Calculate stats
    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter(task => task.completed).length;
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    
    return {
      total: totalTasks,
      completed: completedTasks,
      pending: totalTasks - completedTasks,
      completionRate: Math.round(completionRate)
    };
  };

  // Start editing a specific cell
  const startEditingCell = (dateKey: string, cellIndex: number) => {
    setEditingCell(`${dateKey}-${cellIndex}`);
  };

  // Add a global task (from the top button)
  const addGlobalTask = () => {
    // Default to today's date
    const todayKey = formatDateKey(new Date());
    
    if (getFirstAvailableCellIndex(todayKey) !== null) {
      startEditingCell(todayKey, getFirstAvailableCellIndex(todayKey) || 0);
    } else {
      setErrorMessage("Максимум 5 задач на день");
      
      setTimeout(() => {
        setErrorMessage(null);
      }, 3000);
    }
  };

  // Weekly goal key
  const weeklyGoalKey = `weekly-goal-${format(currentDate, 'yyyy-MM-dd')}`;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only process if not editing
      if (editingCell !== null) return;
      
      // Navigate with keyboard
      if (e.key === 'ArrowLeft') {
        navigatePrevious();
      } else if (e.key === 'ArrowRight') {
        navigateNext();
      } else if (e.key === 't' && e.altKey) {
        goToToday();
      } else if (e.key === 'f' && e.altKey) {
        toggleFocusMode();
      } else if (e.key === 'm' && e.altKey) {
        toggleViewMode(viewMode === 'week' ? 'month' : 'week');
      } else if (e.key === 'a' && e.altKey) {
        addGlobalTask();
      } else if (e.key === 's' && e.altKey) {
        setShowStats(!showStats);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentDate, viewMode, focusModeEnabled, editingCell, showStats]);

  // Render the month view grid
  const renderMonthView = () => {
    return (
      <div className="flex-1 flex flex-col bg-[#121212]">
        {/* Days of week header */}
        <div className="grid grid-cols-7">
          {RUSSIAN_DAYS.map((day, index) => (
            <div 
              key={`month-header-${index}`} 
              className="py-2 text-center text-xs font-medium border-b border-neutral-700/60 border-r border-neutral-700/60 last:border-r-0"
            >
              {day}
            </div>
          ))}
        </div>
        
        {/* Month grid - exactly 5 rows */}
        <div className="flex-1 grid grid-cols-7 grid-rows-5">
          {monthDays.map((week, rowIndex) => {
            // Check if this week contains the current date for focus mode
            const weekContainsCurrentDate = week.some(date => isCurrentWeek(date));
            
            return week.map((date, colIndex) => {
              const dateKey = formatDateKey(date);
              const isCurrentMonth = isSameMonth(date, currentDate);
              const isToday = isSameDay(date, new Date());
              const dayTasks = getTasksForDate(date);
              
              return (
                <div 
                  key={`${rowIndex}-${colIndex}`}
                  className={`${
                    isCurrentMonth ? 'bg-[#121212]' : 'bg-[#121212] opacity-40'
                  } ${isToday ? 'bg-neutral-800/20' : ''} 
                  border-r border-neutral-700/60 border-b border-neutral-800/30
                  relative flex flex-col h-full`}
                >
                  {/* Date number */}
                  <div className="p-2 text-sm">
                    {/* Content gets blurred in focus mode */}
                    <div className={`${focusModeEnabled && !weekContainsCurrentDate ? 'opacity-30 blur-[2px]' : ''} transition-all duration-300`}>
                      {format(date, 'd')}
                    </div>
                  </div>
                  
                  {/* Tasks list (up to 5 tasks) */}
                  <div className="flex-1 flex flex-col p-1 space-y-1">
                    {/* Content gets blurred in focus mode */}
                    <div className={`w-full h-full ${focusModeEnabled && !weekContainsCurrentDate ? 'opacity-30 blur-[2px]' : ''} transition-all duration-300`}>
                      {dayTasks.slice(0, 5).map((task) => (
                        <div 
                          key={task.id}
                          className="flex items-center text-xs rounded py-1 px-2 bg-neutral-800/30"
                        >
                          <div className="flex items-center flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={task.completed}
                              onChange={() => toggleTaskCompletion(dateKey, task.id)}
                              className="mr-2 h-3 w-3"
                            />
                            <span className={`${task.completed ? 'line-through text-neutral-500' : 'text-neutral-300'} truncate`}>
                              {task.text}
                            </span>
                          </div>
                          <button 
                            onClick={() => removeTask(dateKey, task.id)}
                            className="text-neutral-500 opacity-0 group-hover:opacity-100 hover:text-red-400 ml-1"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      
                      {/* Add task button (only for current month days) */}
                      {isCurrentMonth && dayTasks.length < 5 && (
                        <button
                          onClick={() => startEditingCell(dateKey, getFirstAvailableCellIndex(dateKey) || 0)}
                          className="text-xs text-neutral-500 hover:text-neutral-300 mt-auto opacity-0 hover:opacity-100"
                        >
                          <Plus size={14} className="inline mr-1" />
                          <span>Добавить</span>
                        </button>
                      )}
                    </div>
                    
                    {/* Editing form */}
                    {editingCell && editingCell.startsWith(dateKey) && (
                      <div className="absolute top-0 left-0 right-0 bottom-0 bg-neutral-900/90 p-2 z-10 flex flex-col">
                        <div className="text-sm mb-2">Новая задача</div>
                        <input
                          type="text"
                          value={newTaskText[dateKey] || ''}
                          onChange={(e) => handleInputChange(dateKey, e.target.value)}
                          onKeyPress={(e) => handleKeyPress(e, dateKey)}
                          placeholder="Название задачи..."
                          className="w-full bg-neutral-800/50 border border-neutral-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-neutral-600 mono"
                          autoFocus
                        />
                        <div className="flex justify-end mt-2">
                          <button
                            onClick={() => setEditingCell(null)}
                            className="text-xs text-neutral-400 mr-2 hover:text-white mono"
                          >
                            Отмена
                          </button>
                          <button
                            onClick={() => addTask(dateKey)}
                            className="text-xs bg-neutral-700 text-white px-3 py-1 rounded mono"
                          >
                            Добавить
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            });
          })}
        </div>
      </div>
    );
  };

  // Render the week view (original view)
  const renderWeekView = () => {
    // Get today's date for focus mode highlight
    const today = new Date();
    const todayDateKey = formatDateKey(today);
    
    return (
      <div className="flex-1 flex flex-col">
        {/* Days of week header */}
        <div className="grid grid-cols-8 border-b border-neutral-700/60 bg-[#121212]">
          {weekDays.map((date, index) => {
            const dateKey = formatDateKey(date);
            const isTodayDate = isSameDay(date, today);
            
            return (
              <div 
                key={`day-${index}`} 
                className={`py-2 px-4 text-left text-xs font-medium ${
                  isTodayDate ? 'bg-neutral-800/30' : ''
                } border-r border-neutral-700/60 transition-all duration-300`}
              >
                {/* Content container that gets blurred in focus mode */}
                <div className={`${focusModeEnabled && !isTodayDate ? 'opacity-30 blur-[2px]' : ''} transition-all duration-300`}>
                  <span className="mono text-neutral-400">{RUSSIAN_DAYS[index]}</span><br />
                  <span className={`text-xl ${isTodayDate ? 'text-white' : 'text-white'}`}>
                    {format(date, 'd')}
                  </span>
                </div>
              </div>
            );
          })}
          
          {/* Weekly focus header - Updated to show "Фокус недели" */}
          <div className="py-2 px-4 text-left text-xs font-medium border-r border-neutral-700/60 bg-neutral-800/20">
            <span className="mono text-neutral-400">Фокус недели</span><br />
            <span className="text-xl text-white">{getCurrentWeekNumber()}</span>
          </div>
        </div>
        
        {/* Week Grid with 5 sections per day */}
        <div className="flex-1 grid grid-cols-8">
          {/* Day columns */}
          {weekDays.map((date, dayIndex) => {
            const dateKey = formatDateKey(date);
            const isTodayDate = isSameDay(date, today);
            
            return (
              <div 
                key={`col-${dayIndex}`} 
                // Keep the border visible at all times regardless of focus mode
                className={`relative border-r border-neutral-700/60 ${
                  isTodayDate ? 'bg-neutral-800/10' : ''
                } h-full`}
              >
                {/* Content container that gets blurred in focus mode */}
                <div className={`h-full w-full ${
                  focusModeEnabled && !isTodayDate ? 'opacity-30 blur-[2px]' : ''
                } transition-all duration-300`}>
                  {/* Exactly 5 cells for each day */}
                  <div className="grid grid-rows-5 h-full">
                    {Array.from({ length: 5 }).map((_, cellIndex) => {
                      const cellKey = `${dateKey}-${cellIndex}`;
                      const task = getTaskForCell(dateKey, cellIndex);
                      const isEditing = editingCell === cellKey;
                      const isLastCell = cellIndex === 4;
                      
                      return (
                        <div 
                          key={cellKey}
                          className={`${!isLastCell ? 'border-b border-neutral-800/30' : ''} p-2 relative hover:bg-neutral-800/20`}
                        >
                          {task ? (
                            // Task display
                            <div className="flex items-center justify-between group text-left p-2 rounded hover:bg-neutral-800/50 h-full">
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={task.completed}
                                  onChange={() => toggleTaskCompletion(dateKey, task.id)}
                                  className="mr-2 h-3 w-3"
                                />
                                <span className={`text-sm ${
                                  task.completed ? 'line-through text-neutral-500' : 'text-neutral-300'
                                }`}>
                                  {task.text}
                                </span>
                              </div>
                              <button 
                                onClick={() => removeTask(dateKey, task.id)}
                                className="text-neutral-500 opacity-0 group-hover:opacity-100 hover:text-red-400"
                              >
                                ✕
                              </button>
                            </div>
                          ) : isEditing ? (
                            // Editing form
                            <div className="bg-neutral-800/30 rounded-md p-2 h-full">
                              <input
                                type="text"
                                value={newTaskText[dateKey] || ''}
                                onChange={(e) => handleInputChange(dateKey, e.target.value)}
                                onKeyPress={(e) => handleKeyPress(e, dateKey)}
                                placeholder="Название задачи..."
                                className="w-full bg-neutral-800/50 border border-neutral-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-neutral-600 mono"
                                autoFocus
                              />
                              <div className="flex justify-end mt-2">
                                <button
                                  onClick={() => setEditingCell(null)}
                                  className="text-xs text-neutral-400 mr-2 hover:text-white mono"
                                >
                                  Отмена
                                </button>
                                <button
                                  onClick={() => addTask(dateKey)}
                                  className="text-xs bg-neutral-700 text-white px-3 py-1 rounded mono"
                                >
                                  Добавить
                                </button>
                              </div>
                            </div>
                          ) : (
                            // Empty cell with add button
                            <button
                              onClick={() => startEditingCell(dateKey, cellIndex)}
                              className="w-full h-full flex items-center justify-center opacity-0 hover:opacity-100"
                            >
                              <div className="flex items-center justify-center text-xs text-neutral-500 hover:text-neutral-300">
                                <Plus size={14} className="mr-1" />
                                <span className="mono">Добавить</span>
                              </div>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
          
          {/* Weekly goal column */}
          <div className="bg-neutral-800/10 border-r border-neutral-700/60 relative h-full">
            <div className="grid grid-rows-5 h-full">
              {Array.from({ length: 5 }).map((_, cellIndex) => {
                const cellKey = `${weeklyGoalKey}-${cellIndex}`;
                const task = getTaskForCell(weeklyGoalKey, cellIndex);
                const isEditing = editingCell === cellKey;
                const isLastCell = cellIndex === 4;
                
                return (
                  <div 
                    key={cellKey}
                    className={`${!isLastCell ? 'border-b border-neutral-800/30' : ''} p-2 relative hover:bg-neutral-800/20`}
                  >
                    {task ? (
                      // Task display
                      <div className="flex items-center justify-between group text-left p-2 rounded hover:bg-neutral-800/50 h-full">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={task.completed}
                            onChange={() => toggleTaskCompletion(weeklyGoalKey, task.id)}
                            className="mr-2 h-3 w-3"
                          />
                          <span className={`text-sm ${
                            task.completed ? 'line-through text-neutral-500' : 'text-neutral-300'
                          }`}>
                            {task.text}
                          </span>
                        </div>
                        <button 
                          onClick={() => removeTask(weeklyGoalKey, task.id)}
                          className="text-neutral-500 opacity-0 group-hover:opacity-100 hover:text-red-400"
                        >
                          ✕
                        </button>
                      </div>
                    ) : isEditing ? (
                      // Editing form
                      <div className="bg-neutral-800/30 rounded-md p-2 h-full">
                        <input
                          type="text"
                          value={newTaskText[weeklyGoalKey] || ''}
                          onChange={(e) => handleInputChange(weeklyGoalKey, e.target.value)}
                          onKeyPress={(e) => handleKeyPress(e, weeklyGoalKey)}
                          placeholder="Цель недели..."
                          className="w-full bg-neutral-800/50 border border-neutral-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-neutral-600 mono"
                          autoFocus
                        />
                        <div className="flex justify-end mt-2">
                          <button
                            onClick={() => setEditingCell(null)}
                            className="text-xs text-neutral-400 mr-2 hover:text-white mono"
                          >
                            Отмена
                          </button>
                          <button
                            onClick={() => addTask(weeklyGoalKey)}
                            className="text-xs bg-neutral-700 text-white px-3 py-1 rounded mono"
                          >
                            Добавить
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Empty cell with add button
                      <button
                        onClick={() => startEditingCell(weeklyGoalKey, cellIndex)}
                        className="w-full h-full flex items-center justify-center opacity-0 hover:opacity-100"
                      >
                        <div className="flex items-center justify-center text-xs text-neutral-500 hover:text-neutral-300">
                          <Plus size={14} className="mr-1" />
                          <span className="mono">Добавить цель</span>
                        </div>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render statistics panel
  const renderStats = () => {
    const stats = getStats();
    
    return (
      <div className="absolute right-4 top-14 bg-neutral-900 border border-neutral-800 rounded-md shadow-lg p-4 z-50 w-64">
        <h3 className="text-sm font-medium mb-3">Статистика {viewMode === 'week' ? 'недели' : 'месяца'}</h3>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-neutral-400">Всего задач:</span>
            <span className="text-sm">{stats.total}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-xs text-neutral-400">Выполнено:</span>
            <span className="text-sm text-green-500">{stats.completed}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-xs text-neutral-400">Осталось:</span>
            <span className="text-sm text-yellow-500">{stats.pending}</span>
          </div>
          
          <div className="pt-2">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-neutral-400">Прогресс:</span>
              <span className="text-xs">{stats.completionRate}%</span>
            </div>
            <div className="w-full bg-neutral-800 rounded-full h-1.5">
              <div 
                className="bg-blue-600 h-1.5 rounded-full" 
                style={{ width: `${stats.completionRate}%` }}
              ></div>
            </div>
          </div>
        </div>
        
        <div className="mt-4 pt-3 border-t border-neutral-800">
          <div className="text-xs text-neutral-500">
            Подсказка: используйте <kbd className="bg-neutral-800 px-1.5 py-0.5 rounded text-xs">Alt</kbd> + клавиши:
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="text-xs text-neutral-400">
              <kbd className="bg-neutral-800 px-1 py-0.5 rounded text-xs">←/→</kbd> Навигация
            </div>
            <div className="text-xs text-neutral-400">
              <kbd className="bg-neutral-800 px-1 py-0.5 rounded text-xs">t</kbd> Сегодня
            </div>
            <div className="text-xs text-neutral-400">
              <kbd className="bg-neutral-800 px-1 py-0.5 rounded text-xs">m</kbd> Вид
            </div>
            <div className="text-xs text-neutral-400">
              <kbd className="bg-neutral-800 px-1 py-0.5 rounded text-xs">f</kbd> Фокус
            </div>
            <div className="text-xs text-neutral-400">
              <kbd className="bg-neutral-800 px-1 py-0.5 rounded text-xs">a</kbd> Добавить
            </div>
            <div className="text-xs text-neutral-400">
              <kbd className="bg-neutral-800 px-1 py-0.5 rounded text-xs">s</kbd> Статистика
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-[#121212]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 bg-[#121212] text-white overflow-hidden">
      {/* Top Navigation Bar */}
      <div className="py-3 px-4 flex items-center border-b border-neutral-800">
        {/* Only Focus mode button in the left side now */}
        <div className="flex items-center">
          <button 
            onClick={toggleFocusMode}
            className={`rounded-md px-3 py-1.5 flex items-center text-sm font-medium ${
              focusModeEnabled 
                ? 'bg-neutral-800 text-white border border-neutral-700' 
                : 'bg-neutral-800 text-white'
            }`}
            title="Режим фокусировки (Alt+F)"
          >
            <Eye size={16} className="mr-1" />
            Focus 5
          </button>
        </div>
        
        {/* Center - Date navigation */}
        <div className="flex items-center mx-auto space-x-2">
          <button 
            onClick={navigatePrevious}
            className="p-1 text-neutral-400 hover:text-white"
          >
            <ChevronLeft size={18} />
          </button>
          <button 
            onClick={goToToday}
            className="text-neutral-300 text-sm hover:text-white"
            title="Alt+T"
          >
            Сегодня
          </button>
          <button 
            onClick={navigateNext}
            className="p-1 text-neutral-400 hover:text-white"
          >
            <ChevronRight size={18} />
          </button>
          <div className="relative">
            <button 
              onClick={() => setShowMonthSelector(!showMonthSelector)}
              className="ml-2 text-neutral-400 text-sm mono hover:text-white flex items-center"
            >
              {RUSSIAN_MONTHS[getMonth(currentDate)]} {getYear(currentDate)}
              <ChevronDown />
            </button>
            
            {/* Month selector dropdown */}
            {showMonthSelector && (
              <div className="absolute z-10 mt-1 bg-neutral-900 border border-neutral-800 rounded-md shadow-lg p-2 w-48">
                <div className="grid grid-cols-3 gap-1">
                  {RUSSIAN_MONTHS.map((monthName, index) => (
                    <button
                      key={monthName}
                      onClick={() => changeMonth(index)}
                      className={`text-xs p-2 rounded hover:bg-neutral-800 ${
                        getMonth(currentDate) === index ? 'bg-neutral-800 text-white' : 'text-neutral-400'
                      }`}
                    >
                      {monthName}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Right side - View mode selector */}
        <div className="flex items-center space-x-4">
          <button 
            className={`text-sm px-3 py-1 rounded ${viewMode === 'week' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'}`}
            onClick={() => toggleViewMode('week')}
            title="Alt+M"
          >
            Неделя
          </button>
          <button 
            className={`text-sm px-3 py-1 rounded ${viewMode === 'month' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'}`}
            onClick={() => toggleViewMode('month')}
            title="Alt+M"
          >
            Месяц
          </button>
        </div>
      </div>
      
      {/* Error message */}
      {errorMessage && (
        <div className="bg-red-950/30 border-b border-red-900 text-red-400 px-4 py-1 text-sm text-center">
          {errorMessage}
        </div>
      )}
      
      {/* Main Calendar Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Calendar Content - conditionally render week or month view */}
        {viewMode === 'week' ? renderWeekView() : renderMonthView()}
        
        {/* Render statistics when toggled */}
        {showStats && renderStats()}
      </div>
      
      {/* Bottom indicator */}
      <div className="flex justify-center p-2 border-t border-neutral-800">
        <div className="w-8 h-1 bg-neutral-700 rounded-full"></div>
      </div>
    </div>
  );
};

// Helper component for chevron down icon
const ChevronDown = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export default Calendar;