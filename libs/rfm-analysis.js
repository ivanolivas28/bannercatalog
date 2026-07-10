/**
 * RFM Analysis Engine
 *
 * Recency: Days since last purchase
 * Frequency: Number of purchases in last 12 months
 * Monetary: Total spent
 */

const RECENCY_THRESHOLDS = {
  excellent: 30,      // < 30 days
  good: 90,           // 30-90 days
  fair: 180,          // 90-180 days
  poor: 365,          // 180-365 days
  abandoned: 999999,  // > 365 days
};

const FREQUENCY_THRESHOLDS = {
  excellent: 12, // >= 1 per month
  good: 6,       // 6+ per year
  fair: 3,       // 3-5 per year
  poor: 1,       // 1-2 per year
  none: 0,
};

const MONETARY_THRESHOLDS = {
  high: 50000,
  medium: 10000,
  low: 1000,
  minimal: 0,
};

/**
 * Calculate RFM score and segment for a single customer
 */
export function calculateRFM(customer) {
  const now = new Date();

  // Calculate Recency (days since last purchase)
  let recencyDays = 999999;
  let recencyScore = 0;

  if (customer.lastQuotationDate || customer.lastOrderDate) {
    const lastDate = new Date(customer.lastQuotationDate || customer.lastOrderDate);
    recencyDays = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));

    if (recencyDays <= RECENCY_THRESHOLDS.excellent) recencyScore = 100;
    else if (recencyDays <= RECENCY_THRESHOLDS.good) recencyScore = 80;
    else if (recencyDays <= RECENCY_THRESHOLDS.fair) recencyScore = 60;
    else if (recencyDays <= RECENCY_THRESHOLDS.poor) recencyScore = 30;
    else recencyScore = 5;
  }

  // Calculate Frequency (purchases in last 12 months)
  const frequencyCount = customer.quotationCount || 0;
  let frequencyScore = 0;

  if (frequencyCount >= FREQUENCY_THRESHOLDS.excellent) frequencyScore = 100;
  else if (frequencyCount >= FREQUENCY_THRESHOLDS.good) frequencyScore = 80;
  else if (frequencyCount >= FREQUENCY_THRESHOLDS.fair) frequencyScore = 60;
  else if (frequencyCount >= FREQUENCY_THRESHOLDS.poor) frequencyScore = 30;
  else frequencyScore = 5;

  // Calculate Monetary (total spent)
  const totalSpent = customer.totalSpent || 0;
  let monetaryScore = 0;

  if (totalSpent >= MONETARY_THRESHOLDS.high) monetaryScore = 100;
  else if (totalSpent >= MONETARY_THRESHOLDS.medium) monetaryScore = 80;
  else if (totalSpent >= MONETARY_THRESHOLDS.low) monetaryScore = 60;
  else if (totalSpent > 0) monetaryScore = 30;
  else monetaryScore = 5;

  // Combined RFM score (weighted average)
  const rfmScore = Math.round((recencyScore * 0.4 + frequencyScore * 0.35 + monetaryScore * 0.25));

  // Determine segment
  let segment = "prospect";

  if (frequencyCount === 0 && totalSpent === 0) {
    segment = "prospect";
  } else if (recencyDays > 365 && totalSpent > 0) {
    segment = "dormant";
  } else if (recencyScore >= 80 && monetaryScore >= 80) {
    segment = "vip_active";
  } else if (recencyScore >= 60 && frequencyScore >= 60) {
    segment = "active";
  } else if (recencyScore < 30 && totalSpent > 0) {
    segment = "at_risk";
  } else {
    segment = "active";
  }

  return {
    rfmScore,
    segment,
    recencyScore,
    frequencyScore,
    monetaryScore,
    recencyDays,
    frequencyCount,
    totalSpent,
  };
}

/**
 * Determine priority and task type based on RFM segment
 */
export function determinePriority(customer, rfmData) {
  const { segment, rfmScore, recencyDays } = rfmData;

  let priority = "low";
  let taskType = "prospection";
  let description = "";
  let title = "";

  if (segment === "vip_active") {
    priority = "high";
    taskType = "follow_up";
    title = `Seguimiento VIP - ${customer.nombre || customer.empresa}`;
    description = `Cliente VIP activo. Última compra hace ${recencyDays} días. Total invertido: $${rfmData.totalSpent}`;
  } else if (segment === "active" && recencyDays > 30) {
    priority = "high";
    taskType = "email";
    title = `Email reabastecimiento - ${customer.empresa}`;
    description = `Cliente activo. Tiempo desde última compra: ${recencyDays} días`;
  } else if (segment === "at_risk") {
    priority = "urgent";
    taskType = "call";
    title = `LLAMADA - Reactivar ${customer.empresa}`;
    description = `Cliente en riesgo. Sin compras hace ${recencyDays} días. Total histórico: $${rfmData.totalSpent}`;
  } else if (segment === "dormant") {
    priority = "high";
    taskType = "call";
    title = `Reactivación - ${customer.empresa}`;
    description = `Cliente dormido. Última compra hace ${recencyDays} días. Valor histórico: $${rfmData.totalSpent}`;
  } else if (segment === "prospect" && rfmScore > 0) {
    priority = "medium";
    taskType = "email";
    title = `Prospección - ${customer.empresa}`;
    description = `Nuevo contacto. Score inicial: ${rfmScore}/100`;
  } else {
    priority = "low";
    taskType = "prospection";
    title = `Lead nuevo - ${customer.empresa}`;
    description = `Lead sin historial`;
  }

  return {
    priority,
    taskType,
    title,
    description,
  };
}

/**
 * Generate all customer metrics for bulk analysis
 */
export function analyzeAllCustomers(customers) {
  return customers.map(customer => {
    const rfmData = calculateRFM(customer);
    const priorityData = determinePriority(customer, rfmData);

    return {
      customerId: customer.id || customer._id,
      odooPartnerId: customer.odooPartnerId,
      customer,
      rfmData,
      priority: priorityData.priority,
      taskType: priorityData.taskType,
      title: priorityData.title,
      description: priorityData.description,
    };
  });
}

/**
 * Filter customers by segment
 */
export function filterBySegment(analyzedCustomers, segment) {
  return analyzedCustomers.filter(c => c.rfmData.segment === segment);
}

/**
 * Sort by priority (for task generation)
 */
export function sortByPriority(analyzedCustomers) {
  const priorityMap = { urgent: 0, high: 1, medium: 2, low: 3 };

  return [...analyzedCustomers].sort((a, b) => {
    const aPriority = priorityMap[a.priority] || 99;
    const bPriority = priorityMap[b.priority] || 99;

    if (aPriority !== bPriority) return aPriority - bPriority;

    return b.rfmData.rfmScore - a.rfmData.rfmScore;
  });
}
