const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { addDays, setDate, addMonths, isAfter, getDay, startOfDay, format, addYears, setMonth, startOfMonth, lastDayOfMonth } = require('date-fns');

admin.initializeApp();
const db = admin.firestore();

// Helper to calculate next scheduled date
const calculateNextScheduledDate = (type, config, fromDateStr = null) => {
  const fromDate = fromDateStr ? startOfDay(new Date(fromDateStr + 'T00:00:00')) : startOfDay(new Date());
  
  if (type === 'daily_interval') {
    const interval = config.interval || 1;
    return format(addDays(fromDate, interval), 'yyyy-MM-dd');
  } 
  
  if (type === 'monthly_interval') {
    const interval = config.interval || 1;
    return format(addMonths(fromDate, interval), 'yyyy-MM-dd');
  }
  
  if (type === 'weekly') {
    const targetDays = config.daysOfWeek || [];
    if (targetDays.length === 0) return format(addDays(fromDate, 1), 'yyyy-MM-dd');
    
    let nextDate = addDays(fromDate, 1);
    for (let i = 0; i < 8; i++) {
      if (targetDays.includes(getDay(nextDate))) {
        return format(nextDate, 'yyyy-MM-dd');
      }
      nextDate = addDays(nextDate, 1);
    }
  }
  
  if (type === 'monthly_date') {
    const targetDate = config.dayOfMonth || 1;
    let nextDate = setDate(fromDate, targetDate);
    if (!isAfter(nextDate, fromDate)) {
      nextDate = setDate(addMonths(fromDate, 1), targetDate);
    }
    return format(nextDate, 'yyyy-MM-dd');
  }
  
  if (type === 'yearly_date') {
    if (!config.targetDate) return format(addYears(fromDate, 1), 'yyyy-MM-dd');
    const parts = config.targetDate.split('-');
    const targetMonth = parseInt(parts[1], 10) - 1;
    const targetDay = parseInt(parts[2], 10);
    
    let nextDate = setDate(setMonth(fromDate, targetMonth), targetDay);
    if (!isAfter(nextDate, fromDate)) {
      nextDate = addYears(nextDate, 1);
    }
    return format(nextDate, 'yyyy-MM-dd');
  }
  
  if (type === 'monthly_specific_day') {
    const targetDow = config.dayOfWeek !== undefined ? config.dayOfWeek : 1;
    const week = config.weekOfMonth || 1;
    
    let dateObj = fromDate;
    for (let attempt = 0; attempt < 2; attempt++) {
      const monthStart = startOfMonth(dateObj);
      let targetDate;
      
      if (week === -1) {
        const monthEnd = lastDayOfMonth(dateObj);
        const endDow = getDay(monthEnd);
        const diff = (endDow - targetDow + 7) % 7;
        targetDate = addDays(monthEnd, -diff);
      } else {
        const startDow = getDay(monthStart);
        const diff = (targetDow - startDow + 7) % 7;
        const firstOcc = addDays(monthStart, diff);
        targetDate = addDays(firstOcc, (week - 1) * 7);
      }
      
      if (isAfter(targetDate, fromDate)) {
        return format(targetDate, 'yyyy-MM-dd');
      }
      dateObj = startOfMonth(addMonths(fromDate, 1));
    }
  }
  
  return format(addDays(fromDate, 1), 'yyyy-MM-dd');
};

exports.generateScheduledTasks = functions.pubsub.schedule('0 1 * * *').timeZone('America/Mexico_City').onRun(async (context) => {
  const today = startOfDay(new Date());
  const todayStr = format(today, 'yyyy-MM-dd');
  
  console.log(`Ejecutando generador de tareas recurrentes para: ${todayStr}`);

  try {
    const recurringRef = db.collection('recurring_tasks');
    const snapshot = await recurringRef
      .where('isActive', '==', true)
      .where('nextScheduledDate', '<=', todayStr)
      .get();

    if (snapshot.empty) {
      console.log('No hay tareas recurrentes programadas para hoy.');
      return null;
    }

    console.log(`Encontradas ${snapshot.size} plantillas para procesar hoy.`);

    const batch = db.batch();

    snapshot.docs.forEach((docSnap) => {
      const template = docSnap.data();

      // Check Expiration
      if (template.endDate && todayStr > template.endDate) {
        console.log(`Plantilla ${docSnap.id} expiró. Eliminando físicamente...`);
        batch.delete(docSnap.ref);
        return;
      }

      // 1. CREATE TASK
      const newTaskRef = db.collection('tasks').doc();
      
      // Calculate Deadline based on DurationDays
      const durationDays = template.durationDays || 1;
      const deadlineDate = addDays(today, durationDays);
      const deadlineStr = format(deadlineDate, 'yyyy-MM-dd');

      const newTask = {
        id: newTaskRef.id,
        projectId: template.projectId,
        companyId: template.companyId,
        title: template.title,
        description: template.description || '',
        priority: template.priority || 'Media',
        assignedUserIds: template.assignedUserIds || [],
        requiresEvidence: template.requiresEvidence || false,
        referenceImages: template.referenceImages || [],
        progress: 0,
        isComplete: false,
        deadline: deadlineStr,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      batch.set(newTaskRef, newTask);

      // 2. CALCULATE NEXT SCHEDULED DATE
      // Note: we calculate the next date relative to TODAY, because if the server was offline
      // and a task is severely delayed, we want it to schedule the next one correctly.
      const nextDateStr = calculateNextScheduledDate(template.recurrenceType, template.recurrenceConfig, todayStr);

      if (template.endDate && nextDateStr > template.endDate) {
        console.log(`Plantilla ${docSnap.id} completó su ciclo. Eliminando físicamente...`);
        batch.delete(docSnap.ref);
      } else {
        batch.update(docSnap.ref, { 
          nextScheduledDate: nextDateStr,
          updatedAt: admin.firestore.FieldValue.serverTimestamp() 
        });
      }
    });

    await batch.commit();
    console.log('Proceso de tareas recurrentes finalizado con éxito.');
    return null;

  } catch (error) {
    console.error('Error generando tareas recurrentes:', error);
    return null;
  }
});

// Notificaciones Push al asignar una tarea
exports.onTaskCreated = functions.firestore
  .document('tasks/{taskId}')
  .onCreate(async (snap, context) => {
    const newTask = snap.data();
    const taskId = context.params.taskId;

    // Si la tarea no tiene usuarios asignados, no hacemos nada
    if (!newTask.assignedUserIds || newTask.assignedUserIds.length === 0) {
      return null;
    }

    // Obtenemos los perfiles de los usuarios asignados para sacar sus FCM Tokens
    const tokens = [];
    const db = admin.firestore();
    
    for (const userId of newTask.assignedUserIds) {
      const userDoc = await db.collection('userProfiles').doc(userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        if (userData.fcmTokens && Array.isArray(userData.fcmTokens)) {
          tokens.push(...userData.fcmTokens);
        } else if (userData.fcmToken) {
          tokens.push(userData.fcmToken);
        }
      }
    }

    if (tokens.length === 0) {
      console.log('No hay tokens FCM para notificar a los usuarios asignados.');
      return null;
    }

    const payload = {
      notification: {
        title: '¡Nueva tarea asignada!',
        body: `Se te ha asignado la tarea: ${newTask.title}`,
      },
      data: {
        taskId: taskId,
        click_action: 'FLUTTER_NOTIFICATION_CLICK', 
        url: `/task/${taskId}` 
      }
    };

    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens: tokens,
        ...payload
      });
      console.log(`Se enviaron ${response.successCount} mensajes correctamente.`);
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.error('Error al enviar al token:', tokens[idx], resp.error);
          }
        });
      }
    } catch (error) {
      console.error('Error enviando notificaciones FCM:', error);
    }

    return null;
  });
