/**
 * Automatic Task Generator
 *
 * Generates tasks based on customer RFM analysis and business rules
 */

/**
 * Generate tasks for a single analyzed customer
 */
export function generateTasksForCustomer(analyzed, daysAhead = 3) {
  const tasks = [];
  const { customer, rfmData, priority, taskType, title, description } = analyzed;
  const { segment, recencyDays } = rfmData;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + daysAhead);

  // Base task
  const baseTask = {
    customerId: analyzed.customerId,
    odooPartnerId: customer.odooPartnerId,
    customer: {
      name: customer.nombre || customer.empresa || "N/A",
      empresa: customer.empresa || "N/A",
      email: customer.email || "N/A",
      whatsapp: customer.whatsapp || "N/A",
      lastQuotationDate: customer.lastQuotationDate,
      totalSpent: rfmData.totalSpent,
      quotationCount: rfmData.frequencyCount,
      segment: segment,
    },
    title,
    description,
    dueDate,
    priority,
    priority_score: getPriorityScore(priority, rfmData),
  };

  // Task type specific logic
  if (segment === "vip_active" && recencyDays > 60) {
    tasks.push({
      ...baseTask,
      type: "call",
      title: `LLAMADA VIP - ${customer.empresa} (${recencyDays} días sin contacto)`,
      suggestedAction: `Hola ${customer.nombre || ""}! Te llamaba para revisar cómo está todo. ¿Necesitas algo para tu producción?`,
      priority: "urgent",
      priority_score: 95,
    });
  }

  if (segment === "at_risk" && recencyDays > 45) {
    tasks.push({
      ...baseTask,
      type: "call",
      title: `URGENTE - Reactivar ${customer.empresa}`,
      suggestedAction: `Hola ${customer.nombre || ""}! Te llamaba porque hace tiempo no sabemos de ti. ¿Cómo está la producción? ¿Algo en lo que podamos ayudarte?`,
      priority: "urgent",
      priority_score: 90,
    });
  }

  if (segment === "dormant") {
    tasks.push({
      ...baseTask,
      type: "email",
      title: `Campaña reactivación - ${customer.empresa}`,
      suggestedAction: "Email: Te extrañamos, conoce nuestras novedades en refacciones industriales",
      priority: "high",
      priority_score: 75,
    });

    // Follow-up call 7 days later
    const followUpDue = new Date();
    followUpDue.setDate(followUpDue.getDate() + 7);

    tasks.push({
      ...baseTask,
      type: "call",
      title: `Seguimiento post-email - ${customer.empresa}`,
      suggestedAction: "Llamar si no abrió el email",
      priority: "medium",
      priority_score: 60,
      dueDate: followUpDue,
    });
  }

  if (segment === "active" && recencyDays > 20) {
    tasks.push({
      ...baseTask,
      type: "email",
      title: `Reabastecimiento - ${customer.empresa}`,
      suggestedAction: "Email: Productos con stock disponible para entrega rápida",
      priority: "medium",
      priority_score: 70,
    });
  }

  if (segment === "prospect" && !customer.lastQuotationDate) {
    tasks.push({
      ...baseTask,
      type: "email",
      title: `Presentación catálogo - ${customer.empresa}`,
      suggestedAction: "Email: Bienvenida + catálogo de refacciones industriales",
      priority: "low",
      priority_score: 40,
    });

    // Follow-up call if no email open
    const callDue = new Date();
    callDue.setDate(callDue.getDate() + 5);

    tasks.push({
      ...baseTask,
      type: "call",
      title: `Prospección - ${customer.empresa}`,
      suggestedAction: `Hola! Te llamaba para presentarme y saber si tienes necesidad de refacciones para tu automatización.`,
      priority: "low",
      priority_score: 35,
      dueDate: callDue,
    });
  }

  // Check for pending quotations
  if (customer.pendingQuotations && customer.pendingQuotations.length > 0) {
    const oldestQuote = customer.pendingQuotations[0];
    const daysOpen = Math.floor(
      (new Date() - new Date(oldestQuote.date_order)) / (1000 * 60 * 60 * 24)
    );

    if (daysOpen >= 7) {
      tasks.push({
        ...baseTask,
        type: "follow_up",
        title: `Seguimiento cotización abierta - ${customer.empresa}`,
        description: `Cotización ${oldestQuote.name} abierta hace ${daysOpen} días`,
        suggestedAction: `Hola, te llamaba para saber si ya revisaste la cotización que te envié.`,
        priority: daysOpen >= 14 ? "urgent" : "high",
        priority_score: daysOpen >= 14 ? 85 : 70,
      });
    }
  }

  return tasks;
}

/**
 * Generate all tasks for batch of customers
 */
export function generateAllTasks(analyzedCustomers, options = {}) {
  const { daysAhead = 3, maxTasksPerCustomer = 3 } = options;

  let allTasks = [];

  for (const analyzed of analyzedCustomers) {
    const customerTasks = generateTasksForCustomer(analyzed, daysAhead);

    // Limit tasks per customer
    const limited = customerTasks
      .sort((a, b) => b.priority_score - a.priority_score)
      .slice(0, maxTasksPerCustomer);

    allTasks = allTasks.concat(limited);
  }

  // Sort by priority score
  return allTasks.sort((a, b) => b.priority_score - a.priority_score);
}

/**
 * Get priority score (0-100)
 */
function getPriorityScore(priority, rfmData) {
  const baseScores = {
    urgent: 90,
    high: 70,
    medium: 50,
    low: 30,
  };

  const base = baseScores[priority] || 50;
  const rfmBoost = (rfmData.rfmScore / 100) * 10;

  return Math.min(100, base + rfmBoost);
}

/**
 * Filter tasks for today
 */
export function getTasksForToday(tasks) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return tasks.filter(t => {
    const dueDate = new Date(t.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate.getTime() <= today.getTime();
  });
}

/**
 * Group tasks by priority
 */
export function groupByPriority(tasks) {
  const grouped = {
    urgent: [],
    high: [],
    medium: [],
    low: [],
  };

  for (const task of tasks) {
    if (grouped[task.priority]) {
      grouped[task.priority].push(task);
    }
  }

  return grouped;
}

/**
 * Filter tasks by type
 */
export function filterByType(tasks, type) {
  return tasks.filter(t => t.type === type);
}
