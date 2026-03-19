require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;
const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID;
const VAPI_PHONE_NUMBER_ID = process.env.VAPI_PHONE_NUMBER_ID;
const PORT = process.env.PORT || 3000;

// ─── POST /vapi-webhook ─────────────────────────────────────────────────────

app.post("/vapi-webhook", async (req, res) => {
  try {
    const { message } = req.body || {};

    // Step 1 — Validate event type
    if (!message || message.type !== "end-of-call-report") {
      console.log(`Ignored event type: ${message?.type || "unknown"}`);
      return res.status(200).json({ status: "ignored" });
    }

    // Step 2 — Extract data from Vapi payload
    const phone = message.call?.customer?.number;
    const summary = message.summary || "";
    const endedAt = message.call?.endedAt || new Date().toISOString();
    const endedReason = message.call?.endedReason || "";
    const pickedUp =
      endedReason !== "voicemail" && endedReason !== "no-answer"
        ? "yes"
        : "no";

    const structuredData = message.structuredData || {};
    const call_outcome = structuredData.call_outcome || "";
    const qualification_score = structuredData.qualification_score || "";
    const lead_team_size = structuredData.lead_team_size || "";
    const lead_crm = structuredData.lead_crm || "";
    const lead_industry = structuredData.lead_industry || "";
    const lead_whatsapp_volume = structuredData.lead_whatsapp_volume || "";
    const lead_source = structuredData.lead_source || "";
    const language_used = structuredData.language_used || "";

    if (!phone) {
      console.log("No phone number found in payload — skipping.");
      return res.status(200).json({ status: "no_phone" });
    }

    console.log(`Processing end-of-call-report for ${phone}`);

    // Step 3 — Search HubSpot for contact by phone
    const searchResponse = await axios.post(
      "https://api.hubapi.com/crm/v3/objects/contacts/search",
      {
        filterGroups: [
          {
            filters: [
              {
                propertyName: "phone",
                operator: "EQ",
                value: phone,
              },
            ],
          },
        ],
        properties: ["sofia_call_count", "phone", "firstname"],
      },
      {
        headers: {
          Authorization: `Bearer ${HUBSPOT_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    const results = searchResponse.data?.results || [];

    if (results.length === 0) {
      console.log(`Contact not found for ${phone}`);
      return res.status(200).json({ status: "contact_not_found" });
    }

    const contact = results[0];
    const contactId = contact.id;
    const currentCallCount = parseInt(contact.properties?.sofia_call_count || "0", 10);

    // Step 4 — Update the HubSpot contact
    await axios.patch(
      `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
      {
        properties: {
          sofia_call_count: String(currentCallCount + 1),
          sofia_last_called_at: endedAt,
          sofia_last_call_outcome: call_outcome,
          sofia_last_call_summary: summary,
          sofia_call_picked_up: pickedUp,
          sofia_demo_booked: call_outcome === "booked" ? "true" : "false",
          sofia_demo_booked_at: call_outcome === "booked" ? endedAt : "",
          sofia_qualification_score: qualification_score,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${HUBSPOT_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Step 5 — Respond
    console.log(
      `Updated HubSpot contact ${contactId} for ${phone} — outcome: ${call_outcome}`
    );
    return res.status(200).json({ status: "updated", contactId });
  } catch (error) {
    console.error("Error processing webhook:", error.message);
    return res.status(200).json({ status: "error", error: error.message });
  }
});

// ─── POST /trigger-call ──────────────────────────────────────────────────────

app.post("/trigger-call", async (req, res) => {
  try {
    const {
      phone,
      lead_first_name,
      lead_last_name,
      lead_company,
      lead_country,
      lead_email,
      lead_trigger,
      sofia_call_count,
      sofia_last_call_outcome,
      sofia_last_call_summary,
      sofia_call_picked_up,
      sofia_demo_booked,
    } = req.body || {};

    if (!phone) {
      console.log("trigger-call: No phone number provided — skipping.");
      return res.status(200).json({ status: "no_phone" });
    }

    console.log(`trigger-call: Initiating Vapi call to ${phone}`);

    const vapiResponse = await axios.post(
      "https://api.vapi.ai/call/phone",
      {
        assistantId: VAPI_ASSISTANT_ID,
        phoneNumberId: VAPI_PHONE_NUMBER_ID,
        customer: {
          number: phone,
          name: `${lead_first_name || ""} ${lead_last_name || ""}`.trim(),
        },
        assistantOverrides: {
          variableValues: {
            phone,
            lead_first_name: lead_first_name || "",
            lead_last_name: lead_last_name || "",
            lead_company: lead_company || "",
            lead_country: lead_country || "",
            lead_email: lead_email || "",
            lead_trigger: lead_trigger || "",
            sofia_call_count: sofia_call_count || "",
            sofia_last_call_outcome: sofia_last_call_outcome || "",
            sofia_last_call_summary: sofia_last_call_summary || "",
            sofia_call_picked_up: sofia_call_picked_up || "",
            sofia_demo_booked: sofia_demo_booked || "",
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${VAPI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(`trigger-call: Call initiated for ${phone} — Vapi call ID: ${vapiResponse.data?.id || "unknown"}`);
    return res.status(200).json({ status: "call initiated" });
  } catch (error) {
    console.error("trigger-call: Error initiating call:", error.message);
    return res.status(200).json({ status: "error", error: error.message });
  }
});

// ─── Health check ────────────────────────────────────────────────────────────

app.get("/", (_req, res) => {
  res.status(200).json({ status: "ok", service: "sofia-webhook" });
});

// ─── Start server ────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`sofia-webhook server running on port ${PORT}`);
});
