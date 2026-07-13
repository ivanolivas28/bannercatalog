import { NextResponse } from "next/server";
import mongoose from "mongoose";
import Customer from "@/models/Customer";
import Task from "@/models/Task";
import OdooSync from "@/models/OdooSync";
import {
  fetchAllContactsPaginated,
  fetchSalesOrdersAboveThreshold,
  fetchCustomerOrderHistory,
} from "@/libs/odoo";
import {
  createOrGetSheet,
  writeContactsToSheet,
  writeSalesOrdersToSheet,
  writeContextToSheet,
} from "@/libs/google-sheets";
import { analyzeAllCustomers, sortByPriority } from "@/libs/rfm-analysis";
import { generateAllTasks } from "@/libs/task-generator";
import connectMongo from "@/libs/mongo";

/**
 * POST /api/tracker/sync
 *
 * Synchronizes data from Odoo:
 * 1. Fetches ALL contacts from Odoo
 * 2. Fetches sales orders/quotations > 1k USD or 10k MXN
 * 3. Creates/updates Google Sheet with all data
 * 4. Analyzes with RFM
 * 5. Generates tasks
 * 6. Saves to MongoDB
 */
export async function POST(req) {
  try {
    await connectMongo();

    // Create sync log entry
    const syncLog = await OdooSync.create({
      syncType: "full",
      status: "in_progress",
    });

    console.log(`[SYNC] Starting full sync ${syncLog._id}`);

    // 1. Fetch ALL contacts from Odoo
    console.log("[SYNC] Fetching ALL contacts from Odoo...");
    const allContacts = await fetchAllContactsPaginated();
    console.log(`[SYNC] Fetched ${allContacts.length} contacts`);

    if (!allContacts || allContacts.length === 0) {
      throw new Error("No contacts found in Odoo");
    }

    // 2. Fetch sales orders and quotations above threshold
    console.log("[SYNC] Fetching sales orders/quotations > 1k USD or 10k MXN...");
    const { confirmedOrders, quotations } = await fetchSalesOrdersAboveThreshold(1000);
    console.log(
      `[SYNC] Fetched ${confirmedOrders.length} confirmed orders and ${quotations.length} quotations`
    );

    // 3. Create or get Google Sheet
    console.log("[SYNC] Creating/updating Google Sheet...");
    const sheetInfo = await createOrGetSheet("Odoo Sales Tracker - Análisis IA");
    console.log(`[SYNC] Sheet ${sheetInfo.created ? "created" : "found"}: ${sheetInfo.url}`);

    // 4. Write data to Google Sheet
    console.log("[SYNC] Writing contacts to sheet...");
    await writeContactsToSheet(sheetInfo.id, allContacts);

    console.log("[SYNC] Writing confirmed orders to sheet...");
    await writeSalesOrdersToSheet(sheetInfo.id, confirmedOrders, "Órdenes");

    console.log("[SYNC] Writing quotations to sheet...");
    await writeSalesOrdersToSheet(sheetInfo.id, quotations, "Cotizaciones");

    // 5. Write context for Claude
    console.log("[SYNC] Writing context information...");
    await writeContextToSheet(sheetInfo.id, {
      contactsCount: allContacts.length,
      ordersCount: confirmedOrders.length,
      quotationsCount: quotations.length,
    });

    // 6. Sync customer data to MongoDB (from contacts)
    console.log("[SYNC] Syncing customer data to MongoDB...");
    const enrichedCustomers = [];
    let newCount = 0;
    let updatedCount = 0;

    for (const contact of allContacts) {
      try {
        // Only sync actual customers (customer_rank > 0)
        if (!contact.customer_rank || contact.customer_rank === 0) {
          continue;
        }

        // Fetch order history
        const orders = await fetchCustomerOrderHistory(contact.id, 50);

        let totalSpent = 0;
        let lastOrderDate = null;

        for (const order of orders) {
          totalSpent += order.amount_total || 0;
          if (!lastOrderDate || new Date(order.date_order) > lastOrderDate) {
            lastOrderDate = order.date_order;
          }
        }

        const customerData = {
          odooPartnerId: contact.id,
          nombre: (contact.name || "").split(" ")[0] || "N/A",
          empresa: contact.name || "N/A",
          email: contact.email || "",
          whatsapp: contact.phone || contact.mobile || "",
          sector: contact.industry_id ? contact.industry_id[1] : "",
          totalSpent,
          quotationCount: orders.length,
          orderCount: orders.length,
          lastOrderDate: lastOrderDate || null,
          lastQuotationDate: lastOrderDate || null,
          lastSyncDate: new Date(),
          status: "active",
        };

        const result = await Customer.findOneAndUpdate(
          { odooPartnerId: contact.id },
          customerData,
          { upsert: true, new: true }
        );

        if (result.isNew) newCount++;
        else updatedCount++;

        enrichedCustomers.push(result.toObject());
      } catch (err) {
        console.error(`[SYNC] Error enriching customer ${contact.id}:`, err.message);
      }
    }

    console.log(`[SYNC] Synced ${newCount} new, ${updatedCount} updated customers`);

    // 7. Analyze with RFM
    console.log("[SYNC] Running RFM analysis...");
    const analyzed = analyzeAllCustomers(enrichedCustomers);
    const sorted = sortByPriority(analyzed);

    console.log(`[SYNC] RFM analysis complete - Top 10 priorities:`);
    sorted.slice(0, 10).forEach((c, i) => {
      console.log(
        `  ${i + 1}. [${c.priority}] ${c.customer.empresa} - Score: ${c.rfmData.rfmScore}`
      );
    });

    // 8. Generate tasks
    console.log("[SYNC] Generating tasks...");
    const allTasks = generateAllTasks(sorted, {
      daysAhead: 7,
      maxTasksPerCustomer: 2,
    });

    console.log(`[SYNC] Generated ${allTasks.length} tasks`);

    // 9. Save tasks to MongoDB
    let tasksCreated = 0;
    for (const taskData of allTasks) {
      try {
        const existingTask = await Task.findOne({
          customerId: taskData.customerId,
          type: taskData.type,
          status: "pending",
          dueDate: {
            $gte: new Date(new Date().setDate(new Date().getDate() - 1)),
            $lte: new Date(new Date().setDate(new Date().getDate() + 8)),
          },
        });

        if (!existingTask) {
          await Task.create(taskData);
          tasksCreated++;
        }
      } catch (err) {
        console.error("[SYNC] Error creating task:", err.message);
      }
    }

    // 10. Update sync log
    await OdooSync.findByIdAndUpdate(syncLog._id, {
      status: "completed",
      completedAt: new Date(),
      duration: Date.now() - syncLog.createdAt.getTime(),
      customersSync: {
        count: enrichedCustomers.length,
        newCount,
        updatedCount,
        lastSyncDate: new Date(),
      },
      quotationsSync: {
        count: quotations.length,
      },
      notes: `${tasksCreated} tasks created. Google Sheet: ${sheetInfo.url}`,
    });

    return NextResponse.json({
      success: true,
      message: "Sync completed successfully",
      data: {
        allContactsCount: allContacts.length,
        customersCount: enrichedCustomers.length,
        newCustomers: newCount,
        updatedCustomers: updatedCount,
        confirmedOrders: confirmedOrders.length,
        quotations: quotations.length,
        tasksCreated,
        googleSheetUrl: sheetInfo.url,
        syncId: syncLog._id,
      },
    });
  } catch (error) {
    console.error("[SYNC] Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/tracker/sync
 *
 * Get sync status and last sync info
 */
export async function GET(req) {
  try {
    await connectMongo();

    const lastSync = await OdooSync.findOne().sort({ createdAt: -1 });

    if (!lastSync) {
      return NextResponse.json({
        success: true,
        data: {
          lastSync: null,
          message: "No sync history",
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        lastSync: {
          id: lastSync._id,
          status: lastSync.status,
          startedAt: lastSync.startedAt,
          completedAt: lastSync.completedAt,
          duration: lastSync.duration,
          customersSync: lastSync.customersSync,
          quotationsSync: lastSync.quotationsSync,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
