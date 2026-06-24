import { format, parseISO, isThisWeek, addWeeks, startOfWeek, endOfWeek, isSameMonth, addMonths } from 'date-fns';
import type { Task } from '../services/taskService';

export interface TaskGroup {
  id: string;
  title: string;
  tasks: Task[];
}

export const groupTasksByDate = (tasks: Task[]): TaskGroup[] => {
  const groups = {
    overdue: { id: 'overdue', title: 'Vencidas', tasks: [] as Task[] },
    today: { id: 'today', title: 'Hoy', tasks: [] as Task[] },
    tomorrow: { id: 'tomorrow', title: 'Mañana', tasks: [] as Task[] },
    thisWeek: { id: 'thisWeek', title: 'Esta Semana', tasks: [] as Task[] },
    nextWeek: { id: 'nextWeek', title: 'Semana que Entra', tasks: [] as Task[] },
    nextMonth: { id: 'nextMonth', title: 'Mes que Entra', tasks: [] as Task[] },
    later: { id: 'later', title: 'Más Adelante', tasks: [] as Task[] },
    completed: { id: 'completed', title: 'Completadas', tasks: [] as Task[] },
  };

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const tomorrowStr = format(new Date(today.getTime() + 86400000), 'yyyy-MM-dd');
  
  const weekOptions = { weekStartsOn: 1 as const }; // Monday

  // Primero ordenamos todas las tareas
  const sortedTasks = [...tasks].sort((a, b) => {
    // Si ambas están completadas, ordenamos por fecha de actualización (más reciente primero)
    if (a.isComplete && b.isComplete) {
      const timeA = a.updatedAt?.toMillis?.() || (a.createdAt as any)?.toMillis?.() || 0;
      const timeB = b.updatedAt?.toMillis?.() || (b.createdAt as any)?.toMillis?.() || 0;
      return timeB - timeA; // Descendente
    }
    // Para tareas pendientes, ordenamos cronológicamente por límite (más próxima primero)
    return (a.deadline || '').localeCompare(b.deadline || '');
  });

  sortedTasks.forEach(task => {
    // Las completadas van siempre a su grupo especial al final
    if (task.isComplete) {
      groups.completed.tasks.push(task);
      return;
    }

    const taskDateStr = task.deadline;
    if (!taskDateStr) {
      groups.later.tasks.push(task);
      return;
    }

    const taskDate = parseISO(taskDateStr);

    if (taskDateStr < todayStr) {
      groups.overdue.tasks.push(task);
    } else if (taskDateStr === todayStr) {
      groups.today.tasks.push(task);
    } else if (taskDateStr === tomorrowStr) {
      groups.tomorrow.tasks.push(task);
    } else if (isThisWeek(taskDate, weekOptions)) {
      groups.thisWeek.tasks.push(task);
    } else {
      const nextWeekStart = format(startOfWeek(addWeeks(today, 1), weekOptions), 'yyyy-MM-dd');
      const nextWeekEnd = format(endOfWeek(addWeeks(today, 1), weekOptions), 'yyyy-MM-dd');
      
      if (taskDateStr >= nextWeekStart && taskDateStr <= nextWeekEnd) {
        groups.nextWeek.tasks.push(task);
      } else if (isSameMonth(taskDate, addMonths(today, 1))) {
        groups.nextMonth.tasks.push(task);
      } else {
        groups.later.tasks.push(task);
      }
    }
  });

  // Retornamos solo los grupos que tienen al menos 1 tarea
  return [
    groups.overdue,
    groups.today,
    groups.tomorrow,
    groups.thisWeek,
    groups.nextWeek,
    groups.nextMonth,
    groups.later,
    groups.completed
  ].filter(g => g.tasks.length > 0);
};
