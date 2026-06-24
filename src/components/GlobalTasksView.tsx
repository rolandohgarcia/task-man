import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, CheckCircle, Clock, Filter, AlertCircle, CalendarDays, Repeat, Trash2, ClipboardList, Eye, Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import { subscribeToGlobalUserTasks, subscribeToGlobalSupervisedTasks, subscribeToGlobalRecurringTasks, deactivateRecurringTask } from '../services/taskService';
import type { Task, RecurringTask } from '../services/taskService';
import { getUserCompanies } from '../services/companyService';
import type { Company } from '../services/companyService';
import { getUserProjects } from '../services/projectService';
import type { Project } from '../services/projectService';
import type { User } from 'firebase/auth';
import TaskForm from './TaskForm';
import RecurringTaskForm from './RecurringTaskForm';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addMonths, subMonths, addDays, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = {
  'es': es,
};
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface GlobalTasksViewProps {
  user: User;
}

const GlobalTasksView = ({ user }: GlobalTasksViewProps) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'mine' | 'supervised' | 'recurring' | 'calendar'>(() => {
    return (localStorage.getItem('globalActiveTab') as any) || 'mine';
  });
  
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [supervisedTasks, setSupervisedTasks] = useState<Task[]>([]);
  const [recurringTasks, setRecurringTasks] = useState<RecurringTask[]>([]);
  const [projectsMap, setProjectsMap] = useState<Record<string, Project>>({});
  const [companies, setCompanies] = useState<Company[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [filterComplete, setFilterComplete] = useState<'all' | 'pending' | 'completed'>(() => {
    return (localStorage.getItem('globalFilterComplete') as any) || 'pending';
  });
  const [filterCompany, setFilterCompany] = useState<string>(() => {
    return localStorage.getItem('globalFilterCompany') || 'all';
  });
  const [selectedEvent, setSelectedEvent] = useState<Task | null>(null);

  // Calendar state
  const [calendarDate, setCalendarDate] = useState<Date>(() => {
    const saved = localStorage.getItem('globalCalendarDate');
    return saved ? new Date(saved) : new Date();
  });
  const [calendarView, setCalendarView] = useState<'month' | 'agenda'>(() => {
    return (localStorage.getItem('globalCalendarView') as any) || 'month';
  });

  // Persist state changes
  useEffect(() => { localStorage.setItem('globalActiveTab', activeTab); }, [activeTab]);
  useEffect(() => { localStorage.setItem('globalFilterComplete', filterComplete); }, [filterComplete]);
  useEffect(() => { localStorage.setItem('globalFilterCompany', filterCompany); }, [filterCompany]);
  useEffect(() => { localStorage.setItem('globalCalendarDate', calendarDate.toISOString()); }, [calendarDate]);
  useEffect(() => { localStorage.setItem('globalCalendarView', calendarView); }, [calendarView]);

  useEffect(() => {
    let unsubMine: (() => void) | undefined;
    let unsubSupervised: (() => void) | undefined;
    let unsubRecurring: (() => void) | undefined;

    const initData = async () => {
      setLoading(true);
      try {
        const [projects, { activeCompanies }] = await Promise.all([
          getUserProjects(user.uid),
          getUserCompanies(user.uid)
        ]);

        const projMap: Record<string, Project> = {};
        projects.forEach(p => { projMap[p.id] = p; });
        setProjectsMap(projMap);
        setCompanies(activeCompanies);

        unsubMine = subscribeToGlobalUserTasks(user.uid, (tasks) => {
          setMyTasks(tasks);
        });

        const projectIds = projects.map(p => p.id);
        if (projectIds.length > 0) {
          unsubSupervised = subscribeToGlobalSupervisedTasks(projectIds, (tasks) => {
            setSupervisedTasks(tasks);
          });
          unsubRecurring = subscribeToGlobalRecurringTasks(projectIds, (tasks) => {
            setRecurringTasks(tasks);
          });
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    initData();

    return () => {
      if (unsubMine) unsubMine();
      if (unsubSupervised) unsubSupervised();
      if (unsubRecurring) unsubRecurring();
    };
  }, [user]);

  // Process lists based on the active tab
  let displayedTasks: Task[] = [];
  if (activeTab === 'mine') {
    displayedTasks = myTasks.filter(t => filterComplete === 'all' ? true : filterComplete === 'completed' ? t.isComplete : !t.isComplete);
  } else if (activeTab === 'supervised') {
    displayedTasks = supervisedTasks.filter(t => filterComplete === 'all' ? true : filterComplete === 'completed' ? t.isComplete : !t.isComplete);
  } else if (activeTab === 'calendar') {
    const all = [...myTasks, ...supervisedTasks].filter(t => filterComplete === 'all' ? true : filterComplete === 'completed' ? t.isComplete : !t.isComplete);
    const uniqueIds = new Set();
    displayedTasks = [];
    all.forEach(t => {
      if (!uniqueIds.has(t.id)) {
        uniqueIds.add(t.id);
        displayedTasks.push(t);
      }
    });
  }

  const filteredTasks = displayedTasks.filter(t => {
    if (filterCompany !== 'all' && t.companyId !== filterCompany) return false;
    return true;
  });
  
  if (activeTab !== 'calendar') {
    filteredTasks.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
  }

  // Generate calendar events
  const calendarEvents = filteredTasks.map(t => {
    return {
      id: t.id,
      title: t.title,
      start: t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt || Date.now()),
      end: new Date(t.deadline + 'T23:59:59'),
      allDay: true,
      resource: t
    };
  });

  const eventPropGetter = (event: any) => {
    const task = event.resource as Task;
    const project = projectsMap[task.projectId];
    const backgroundColor = project?.color || 'var(--primary-color)';
    return { 
      style: { 
        backgroundColor, 
        borderRadius: '4px', 
        opacity: 0.9,
        fontSize: '0.7rem',
        padding: '1px 4px',
        lineHeight: '1.2',
        border: 'none',
        minHeight: '16px'
      } 
    };
  };

  const CustomEvent = ({ event }: any) => {
    return <div style={{ fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.title}</div>;
  };

  const filteredRecurringTasks = recurringTasks.filter(t => {
    if (filterCompany !== 'all' && t.companyId !== filterCompany) return false;
    return true;
  });

  // Helper to format date
  const formatDate = (dateString: string) => {
    const parts = dateString.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const getRecurrenceText = (task: RecurringTask) => {
    if (task.recurrenceType === 'daily_interval') return `Cada ${task.recurrenceConfig.interval || 1} días`;
    if (task.recurrenceType === 'monthly_interval') return `Cada ${task.recurrenceConfig.interval || 1} meses`;
    if (task.recurrenceType === 'weekly') {
      const daysMap = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const days = task.recurrenceConfig?.daysOfWeek?.map((d: number) => daysMap[d]).join(', ');
      return `Semanal: ${days}`;
    }
    if (task.recurrenceType === 'monthly_date') return `Día ${task.recurrenceConfig?.dayOfMonth} del mes`;
    if (task.recurrenceType === 'yearly_date') return `Anual: ${task.recurrenceConfig.targetDate}`;
    if (task.recurrenceType === 'monthly_specific_day') return `Mes específico (Día/Semana)`;
    return 'Recurrente';
  };

  const handleDeleteRecurring = async (id: string, title: string) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar la tarea recurrente "${title}"? Ya no se generarán más tareas automáticamente.`)) {
      await deactivateRecurringTask(id);
      // No need to loadData(), onSnapshot will update the list
    }
  };

  const handleCalendarNavigate = (direction: 'PREV' | 'NEXT') => {
    if (calendarView === 'month') {
      setCalendarDate(direction === 'PREV' ? subMonths(calendarDate, 1) : addMonths(calendarDate, 1));
    } else {
      setCalendarDate(direction === 'PREV' ? subDays(calendarDate, 1) : addDays(calendarDate, 1));
    }
  };

  const handleDrillDown = (date: Date) => {
    setCalendarDate(date);
    setCalendarView('agenda');
  };

  const renderTaskCard = (task: Task) => {
    const project = projectsMap[task.projectId];
    const pColor = project?.color || 'var(--primary-color)';
    const isOverdue = !task.isComplete && new Date(task.deadline).getTime() < new Date().getTime();

    return (
      <div 
        key={task.id} 
        className="card" 
        onClick={() => navigate(`/company/${project?.companyId || 'unknown'}/project/${task.projectId}/task/${task.id}`)}
        style={{ 
          cursor: 'pointer', 
          borderLeft: `18px solid ${pColor}`,
          borderColor: pColor,
          position: 'relative',
          paddingLeft: 'var(--spacing-md)'
        }}
      >
        <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          {/* Circular Progress & Date */}
          <div className="flex-row" style={{ gap: '12px' }}>
            <div style={{ 
              width: '40px', height: '40px', borderRadius: '50%', 
              border: `3px solid ${task.isComplete ? 'var(--success-color)' : 'var(--border-color)'}`,
              borderTopColor: task.progress > 0 ? 'var(--primary-color)' : undefined,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-color)'
            }}>
              {task.progress}%
            </div>
            <div className="flex-col" style={{ gap: 0 }}>
              <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{formatDate(task.deadline)}</span>
              <span style={{ fontSize: '0.75rem', color: task.isComplete ? 'var(--success-color)' : 'var(--text-muted)' }}>
                {task.isComplete ? 'Completada' : task.progress > 0 ? 'En Proceso' : 'Por Empezar'}
              </span>
            </div>
          </div>

          {/* Priority Pill */}
          {task.priority === 'Critica' && (
            <span style={{ color: 'var(--danger-color)', display: 'flex', alignItems: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>
              <AlertCircle size={14} style={{ marginRight: '4px' }}/> Crítica
            </span>
          )}
        </div>

        <h3 style={{ margin: '8px 0 4px 0', color: isOverdue ? 'var(--danger-color)' : 'var(--text-color)' }}>
          {isOverdue && <Clock size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}/>}
          {task.title}
        </h3>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
          {project?.name || 'Proyecto Desconocido'}
        </span>

        <p style={{ fontSize: '0.9rem', color: 'var(--text-color)', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {task.description || 'Sin descripción'}
        </p>
      </div>
    );
  };

  return (
    <div className="flex-col" style={{ 
      paddingBottom: activeTab === 'calendar' ? 0 : 'var(--spacing-xl)'
    }}>
      {/* 100% Width Sticky Header */}
      <div style={{ 
        position: 'sticky', top: '53px', backgroundColor: 'var(--surface-color)', zIndex: 10, 
        borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', 
        justifyContent: 'space-between', padding: '8px var(--spacing-md)'
      }}>
        
        {/* Left side: Icon Tabs */}
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          <button 
            onClick={() => setActiveTab('mine')} title="Mis Tareas"
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '40px', height: '40px', borderRadius: '50%', border: 'none', cursor: 'pointer',
              backgroundColor: activeTab === 'mine' ? 'var(--primary-color)' : 'transparent', 
              color: activeTab === 'mine' ? 'var(--primary-text)' : 'var(--text-muted)',
              transition: 'all 0.2s'
            }}
          >
            <ClipboardList size={22} />
          </button>
          
          <button 
            onClick={() => setActiveTab('supervised')} title="Supervisión"
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '40px', height: '40px', borderRadius: '50%', border: 'none', cursor: 'pointer',
              backgroundColor: activeTab === 'supervised' ? 'var(--primary-color)' : 'transparent', 
              color: activeTab === 'supervised' ? 'var(--primary-text)' : 'var(--text-muted)',
              transition: 'all 0.2s'
            }}
          >
            <Eye size={22} />
          </button>
          
          <button 
            onClick={() => setActiveTab('recurring')} title="Recurrentes"
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '40px', height: '40px', borderRadius: '50%', border: 'none', cursor: 'pointer',
              backgroundColor: activeTab === 'recurring' ? 'var(--primary-color)' : 'transparent', 
              color: activeTab === 'recurring' ? 'var(--primary-text)' : 'var(--text-muted)',
              transition: 'all 0.2s'
            }}
          >
            <Repeat size={22} />
          </button>

          <button 
            onClick={() => setActiveTab('calendar')} title="Calendario"
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '40px', height: '40px', borderRadius: '50%', border: 'none', cursor: 'pointer',
              backgroundColor: activeTab === 'calendar' ? 'var(--success-color)' : 'transparent', 
              color: activeTab === 'calendar' ? 'white' : 'var(--text-muted)',
              transition: 'all 0.2s'
            }}
          >
            <CalendarDays size={22} />
          </button>
        </div>

        {/* Right side: Filters */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          
          {/* Company Filter */}
          <div style={{ position: 'relative', width: '24px', height: '24px' }} title="Filtrar por Empresa">
            <Building2 size={24} color={filterCompany !== 'all' ? 'var(--primary-color)' : 'var(--text-muted)'} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} />
            <select 
              style={{ opacity: 0, width: '100%', height: '100%', cursor: 'pointer', appearance: 'none', position: 'absolute', top: 0, left: 0 }}
              value={filterCompany}
              onChange={(e: any) => setFilterCompany(e.target.value)}
            >
              <option value="all">Todas las Empresas</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          {activeTab !== 'recurring' && (
            <div style={{ position: 'relative', width: '24px', height: '24px' }} title="Filtrar por Estado">
              <Filter size={24} color={filterComplete !== 'pending' ? 'var(--primary-color)' : 'var(--text-muted)'} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} />
              <select 
                style={{ opacity: 0, width: '100%', height: '100%', cursor: 'pointer', appearance: 'none', position: 'absolute', top: 0, left: 0 }}
                value={filterComplete}
                onChange={(e: any) => setFilterComplete(e.target.value)}
              >
                <option value="pending">Pendientes</option>
                <option value="all">Todas</option>
                <option value="completed">Completadas</option>
              </select>
            </div>
          )}

        </div>
      </div>

      {/* Task List Content */}
      {activeTab === 'calendar' ? (
        calendarView === 'month' ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 110px)', backgroundColor: 'var(--surface-color)', width: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
              
              {/* Custom Calendar Header */}
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '8px 16px', gap: '24px', backgroundColor: 'var(--bg-color)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-color)' }}>
                <button 
                  onClick={() => handleCalendarNavigate('PREV')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                >
                  <ChevronLeft size={28} />
                </button>
                
                <h2 style={{ margin: 0, minWidth: '180px', textAlign: 'center', textTransform: 'capitalize', fontSize: '1.2rem' }}>
                  {format(calendarDate, 'MMMM yyyy', { locale: es })}
                </h2>
                
                <button 
                  onClick={() => handleCalendarNavigate('NEXT')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                >
                  <ChevronRight size={28} />
                </button>
              </div>

              <div style={{ flex: 1, padding: '8px 16px' }}>
                <Calendar
                  localizer={localizer}
                  events={calendarEvents}
                  startAccessor="start"
                  endAccessor="end"
                  style={{ height: '100%', fontFamily: 'inherit' }}
                  toolbar={false}
                  date={calendarDate}
                  view="month"
                  onNavigate={(d) => setCalendarDate(d)}
                  onDrillDown={handleDrillDown}
                  selectable={true}
                  onSelectSlot={(slotInfo) => handleDrillDown(slotInfo.start)}
                  onSelectEvent={(e) => handleDrillDown(e.start)}
                  messages={{
                    showMore: (total) => `+${total}`,
                    noEventsInRange: 'No hay tareas programadas para este rango.',
                    previous: 'Ant',
                    next: 'Sig',
                    today: 'Hoy',
                    month: 'Mes',
                    week: 'Semana',
                    day: 'Día',
                    agenda: 'Agenda',
                    date: 'Fecha',
                    time: 'Hora',
                    event: 'Evento'
                  }}
                  components={{
                    event: CustomEvent
                  }}
                  culture="es"
                  eventPropGetter={eventPropGetter}
                  popup={false}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-col" style={{ width: '100%', padding: '0 var(--spacing-md)', backgroundColor: 'var(--bg-color)' }}>
            <div style={{ position: 'sticky', top: '110px', zIndex: 5, display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 16px', backgroundColor: 'var(--bg-color)', borderBottom: '1px solid var(--border-color)', marginBottom: 'var(--spacing-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button 
                  onClick={() => handleCalendarNavigate('PREV')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-color)' }}
                >
                  <ChevronLeft size={28} />
                </button>
                
                <h2 style={{ margin: 0, textAlign: 'center', textTransform: 'capitalize', fontSize: '1.2rem', flex: 1, color: 'var(--text-color)' }}>
                  {format(calendarDate, "d 'de' MMMM, yyyy", { locale: es })}
                </h2>
                
                <button 
                  onClick={() => handleCalendarNavigate('NEXT')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-color)' }}
                >
                  <ChevronRight size={28} />
                </button>
              </div>

              <button 
                onClick={() => setCalendarView('month')}
                style={{ background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '20px', padding: '10px 16px', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}
              >
                Volver al Mes
              </button>
            </div>
            
            {(() => {
              const checkDate = new Date(calendarDate);
              checkDate.setHours(0,0,0,0);
              const agendaTasks = filteredTasks.filter(t => {
                const start = t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt || Date.now());
                start.setHours(0,0,0,0);
                const end = new Date(t.deadline + 'T23:59:59');
                return checkDate.getTime() >= start.getTime() && checkDate.getTime() <= end.getTime();
              });

              if (agendaTasks.length === 0) {
                return (
                  <div style={{ textAlign: 'center', marginTop: 'var(--spacing-xl)', color: 'var(--text-muted)' }}>
                    <CalendarDays size={48} style={{ opacity: 0.5, marginBottom: 'var(--spacing-md)' }} />
                    <p>No hay tareas programadas para este día.</p>
                  </div>
                );
              }

              return agendaTasks.map(task => renderTaskCard(task));
            })()}
          </div>
        )
      ) : (
        <div className="container flex-col" style={{ marginTop: 0, paddingTop: 'var(--spacing-sm)' }}>
          {loading ? (
          <p style={{ textAlign: 'center', marginTop: 'var(--spacing-lg)' }}>Cargando tareas...</p>
        ) : filteredTasks.length === 0 && activeTab !== 'recurring' ? (
          <div style={{ textAlign: 'center', marginTop: 'var(--spacing-xl)', color: 'var(--text-muted)' }}>
            <CheckCircle size={48} style={{ opacity: 0.5, marginBottom: 'var(--spacing-md)' }} />
            <p>No hay tareas pendientes en esta vista.</p>
          </div>
        ) : activeTab === 'recurring' ? (
          <div className="flex-col">
            {filteredRecurringTasks.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                <Repeat size={48} style={{ color: 'var(--text-muted)', marginBottom: 'var(--spacing-md)', opacity: 0.5 }} />
                <p style={{ color: 'var(--text-muted)' }}>No hay tareas recurrentes para mostrar.</p>
              </div>
            ) : (
              filteredRecurringTasks.map(task => (
                <div key={task.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderColor: 'var(--success-color)', borderLeftWidth: '18px', borderLeftColor: 'var(--success-color)' }}>
                  <div style={{ flex: 1, paddingRight: 'var(--spacing-md)' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', marginBottom: '4px' }}>{task.title}</h3>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                      {projectsMap[task.projectId]?.name || 'Proyecto Desconocido'}
                    </p>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', backgroundColor: 'var(--surface-color)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                        <Repeat size={14} /> {getRecurrenceText(task)}
                      </div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', backgroundColor: 'var(--surface-color)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                        <CalendarDays size={14} /> Próxima: {task.nextScheduledDate}
                      </div>
                    </div>
                    {task.endDate && (
                      <p style={{ margin: 0, marginTop: '8px', fontSize: '0.8rem', color: 'var(--danger-color)' }}>
                        Termina el: {task.endDate}
                      </p>
                    )}
                  </div>
                  
                  <button 
                    onClick={() => handleDeleteRecurring(task.id, task.title)}
                    style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', padding: '8px', backgroundColor: 'rgba(204, 0, 0, 0.1)', borderRadius: '50%' }}
                    title="Eliminar plantilla"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              ))
            )}
          </div>
        ) : (
          filteredTasks.map(task => renderTaskCard(task))
        )}
      </div>
      )}

      {/* FABs */}
      {activeTab !== 'recurring' && !showTaskForm && (
        <button className="fab" onClick={() => setShowTaskForm(true)}>
          <Plus size={32} />
        </button>
      )}
      
      {activeTab === 'recurring' && !showRecurringForm && (
        <button className="fab" onClick={() => setShowRecurringForm(true)}>
          <Plus size={32} />
        </button>
      )}

      {/* Forms */}
      {showTaskForm && (
        <TaskForm 
          user={user} 
          onClose={() => setShowTaskForm(false)} 
          onTaskCreated={() => {}} 
        />
      )}

      {showRecurringForm && (
        <RecurringTaskForm 
          user={user} 
          onClose={() => setShowRecurringForm(false)} 
          onTaskCreated={() => {}} 
        />
      )}

    </div>
  );
};

export default GlobalTasksView;
