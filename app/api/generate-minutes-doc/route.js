import Anthropic from "@anthropic-ai/sdk";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import fs from "fs";
import path from "path";
import { auth } from "@/auth";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SECTION_ITEM_SCHEMA = {
  type: "object",
  properties: {
    item_no: { type: "string" },
    matter: { type: "string" },
    action_by: { type: "string" },
    target_date: { type: "string" },
    status: { type: "string" },
  },
  required: ["item_no", "matter", "action_by", "target_date", "status"],
  additionalProperties: false,
};

function sectionsSchemaProps(sections) {
  const props = {};
  sections.forEach((s) => {
    props[s.key] = {
      type: "array",
      description: `Detail rows (numbered ${s.prefix}1, ${s.prefix}2, ...) for the "${s.label}" section — one per discussion point actually covered in the transcript on this topic. The section heading itself is already in the template; do not add a header row. Empty array if nothing was discussed under this topic.`,
      items: SECTION_ITEM_SCHEMA,
    };
  });
  return props;
}

function sectionsPromptBlock(sections) {
  return sections.map((s) => `- ${s.key} ("${s.label}", numbered ${s.prefix}x)`).join("\n");
}

function sectionsRenderData(aiFields, sections) {
  const out = {};
  sections.forEach((s) => {
    out[s.key] = aiFields[s.key] || [];
  });
  return out;
}

const HEADER_COMMON_SCHEMA = {
  chairperson_name: { type: "string", description: "Who chaired/led the meeting, if mentioned. Empty string if not stated." },
  venue: { type: "string", description: "Meeting venue/platform if mentioned. Empty string if not stated." },
  time_start: { type: "string", description: "Meeting start time as HH:MM if mentioned, else empty string." },
  time_end: { type: "string", description: "Meeting end time as HH:MM if mentioned, else empty string." },
  next_meeting_date: { type: "string", description: "Next meeting date as DD/MM/YYYY if mentioned, else empty string." },
  next_meeting_time: { type: "string", description: "Next meeting time as HH:MM if mentioned, else empty string." },
  next_meeting_venue: { type: "string", description: "Next meeting venue if mentioned, else empty string." },
};
const HEADER_COMMON_REQUIRED = ["chairperson_name", "venue", "time_start", "time_end", "next_meeting_date", "next_meeting_time", "next_meeting_venue"];

function attendeeRenderList(attendeeList, fieldNames, statusValues) {
  return attendeeList.map((a, i) => {
    const row = { no: String(i + 1), name: a.name || "" };
    fieldNames.forEach((f) => (row[f] = ""));
    row.status = a.attended === false ? statusValues.absent : statusValues.present;
    return row;
  });
}

// ---------- General Meeting MOM ----------
const GENERAL_MOM = {
  file: "general-mom.docx",
  label: "General Meeting MOM",
  buildSchema() {
    return {
      type: "object",
      properties: {
        ...HEADER_COMMON_SCHEMA,
        matters: {
          type: "array",
          description:
            'Rows for the MATTERS DISCUSSED table. Always include exactly these five category header rows in this order, each with matter set to the fixed label shown and action_by/target_date/status set to "-": item_no "1.0" matter "Confirmation of Previous Minutes"; item_no "2.0" matter "Matters Arising"; item_no "3.0" matter "Agenda Items / New Matters"; item_no "4.0" matter "Any Other Business (AOB)"; item_no "5.0" matter "Date of Next Meeting". Between/after each category header, insert detail rows (numbered 1.1, 1.2, 2.1, 3.1, 3.2, ... etc.) for whatever was actually discussed under that category, with action_by naming an attendee where mentioned, target_date as DD/MM/YYYY if mentioned else empty, and status one of Open/In Progress/Closed/Carried Forward. If nothing was discussed for a category, only its header row (with "-" placeholders) is included — do not invent detail rows.',
          items: SECTION_ITEM_SCHEMA,
        },
      },
      required: [...HEADER_COMMON_REQUIRED, "matters"],
      additionalProperties: false,
    };
  },
  buildPromptExtra() {
    return "";
  },
  mapData(aiFields, ctx) {
    return {
      department: ctx.title || "",
      meeting_no: "",
      date: ctx.date || "",
      time_start: aiFields.time_start || "",
      time_end: aiFields.time_end || "",
      venue: aiFields.venue || ctx.venue || "",
      chairperson_name: aiFields.chairperson_name || "",
      prepared_by_name: ctx.preparedByName,
      reference_no: "",
      distribution_list: ctx.attendeeNames ? `${ctx.attendeeNames} and apologies` : "All attendees",
      attendees: attendeeRenderList(ctx.attendeeList, ["designation", "department_company"], { present: "Present", absent: "Absent" }),
      matters: aiFields.matters || [],
      next_meeting_date: aiFields.next_meeting_date || ctx.nextMeetingDate || "",
      next_meeting_time: aiFields.next_meeting_time || "",
      next_meeting_venue: aiFields.next_meeting_venue || "",
      prepared_by_designation: "",
      prepared_by_date: ctx.date || "",
      confirmed_by_name: "",
      confirmed_by_designation: "",
      confirmed_by_date: "",
    };
  },
};

// ---------- CCM (Consultant Coordination Meeting) MOM ----------
const CCM_SECTIONS = [
  { key: "section_0", prefix: "0.", label: "Confirmation of Previous Minutes & Matters Arising" },
  { key: "section_1", prefix: "1.", label: "Land Matters" },
  { key: "section_2", prefix: "2.", label: "Temporary Labour Quarters (TLQ)" },
  { key: "section_3", prefix: "3.", label: "Development Order (DO / Kebenaran Merancang - KM)" },
  { key: "section_4", prefix: "4.", label: "Building Plan Approval (BP)" },
  { key: "section_5", prefix: "5.", label: "Planning Matters & Sustainability / Green Certification" },
  { key: "section_6", prefix: "6.", label: "Infrastructure Planning (Earthworks, Sewerage, Water, TNB, Telco)" },
  { key: "section_7", prefix: "7.", label: "External Agencies / Authority Approval Status" },
  { key: "section_8", prefix: "8.", label: "Landscape Authority Matters" },
  { key: "section_9", prefix: "9.", label: "Design Development & Coordination (ARC / C&S / M&E / QS / LA / ID)" },
  { key: "section_10", prefix: "10.", label: "Tender, Contract & Cost (QS)" },
  { key: "section_11", prefix: "11.", label: "Any Other Business (AOB)" },
];
const CCM_MOM = {
  file: "ccm-mom.docx",
  label: "CCM (Consultant Coordination Meeting)",
  buildSchema() {
    return {
      type: "object",
      properties: { ...HEADER_COMMON_SCHEMA, ...sectionsSchemaProps(CCM_SECTIONS) },
      required: [...HEADER_COMMON_REQUIRED, ...CCM_SECTIONS.map((s) => s.key)],
      additionalProperties: false,
    };
  },
  buildPromptExtra() {
    return `\n\nSort each discussion point from the transcript into exactly one of these fixed sections (empty array if nothing applies):\n${sectionsPromptBlock(CCM_SECTIONS)}`;
  },
  mapData(aiFields, ctx) {
    return {
      project: ctx.title || "",
      meeting_no: "",
      date: ctx.date || "",
      reference_no: "",
      time_start: aiFields.time_start || "",
      time_end: aiFields.time_end || "",
      venue: aiFields.venue || ctx.venue || "",
      chairperson_name: aiFields.chairperson_name || "",
      prepared_by_name: ctx.preparedByName,
      distribution_list: ctx.attendeeNames ? `${ctx.attendeeNames} and apologies` : "All attendees",
      attendees: attendeeRenderList(ctx.attendeeList, ["designation", "company_discipline"], { present: "Present", absent: "Absent" }),
      ...sectionsRenderData(aiFields, CCM_SECTIONS),
      next_meeting_date: aiFields.next_meeting_date || ctx.nextMeetingDate || "",
      next_meeting_time: aiFields.next_meeting_time || "",
      next_meeting_venue: aiFields.next_meeting_venue || "",
      next_meeting_no: "",
      prepared_by_designation: "",
      prepared_by_date: ctx.date || "",
      confirmed_by_name: "",
      confirmed_by_designation: "",
      confirmed_by_date: "",
    };
  },
};

// ---------- Ground Branding MOM ----------
const GROUND_BRANDING_SECTIONS = [
  { key: "section_2", prefix: "2.", label: "Confirmation of Previous Minutes" },
  { key: "section_3", prefix: "3.", label: "Matters Arising / Action Items Follow-up" },
  { key: "section_4", prefix: "4.", label: "Branding & Signage Inventory & Locations" },
  { key: "section_5", prefix: "5.", label: "Hoarding, Gantry & Boundary Branding" },
  { key: "section_6", prefix: "6.", label: "Wayfinding & Directional Signage" },
  { key: "section_7", prefix: "7.", label: "Sales Gallery & Show Unit Branding" },
  { key: "section_8", prefix: "8.", label: "Digital / LED Screens & AV Displays" },
  { key: "section_9", prefix: "9.", label: "Creative, Collateral & Merchandise" },
  { key: "section_10", prefix: "10.", label: "Corporate Identity (CI) & Digital Assets" },
  { key: "section_11", prefix: "11.", label: "New Branding Requests & Approvals" },
  { key: "section_12", prefix: "12.", label: "Maintenance, Rectification & Defects" },
  { key: "section_13", prefix: "13.", label: "Vendor / Contractor Matters" },
  { key: "section_14", prefix: "14.", label: "Installation Schedule & Timeline" },
  { key: "section_15", prefix: "15.", label: "Budget & Cost" },
  { key: "section_16", prefix: "16.", label: "HSE for Branding & Installation Works" },
  { key: "section_17", prefix: "17.", label: "Any Other Business (AOB)" },
];
const GROUND_BRANDING_MOM = {
  file: "ground-branding-mom.docx",
  label: "Ground Branding Meeting",
  buildSchema() {
    return {
      type: "object",
      properties: { ...HEADER_COMMON_SCHEMA, ...sectionsSchemaProps(GROUND_BRANDING_SECTIONS) },
      required: [...HEADER_COMMON_REQUIRED, ...GROUND_BRANDING_SECTIONS.map((s) => s.key)],
      additionalProperties: false,
    };
  },
  buildPromptExtra() {
    return `\n\nSort each discussion point from the transcript into exactly one of these fixed sections (empty array if nothing applies):\n${sectionsPromptBlock(GROUND_BRANDING_SECTIONS)}`;
  },
  mapData(aiFields, ctx) {
    return {
      project: ctx.title || "",
      meeting_no: "",
      date: ctx.date || "",
      time_start: aiFields.time_start || "",
      time_end: aiFields.time_end || "",
      venue: aiFields.venue || ctx.venue || "",
      prepared_by_name: ctx.preparedByName,
      prepared_by_designation: "",
      reference_no: "",
      attendees: attendeeRenderList(ctx.attendeeList, ["designation", "company_dept"], { present: "P", absent: "Ab" }),
      distribution_list: ctx.attendeeNames ? `${ctx.attendeeNames} and apologies` : "All attendees",
      ...sectionsRenderData(aiFields, GROUND_BRANDING_SECTIONS),
      next_meeting_date: aiFields.next_meeting_date || ctx.nextMeetingDate || "",
      next_meeting_time: aiFields.next_meeting_time || "",
      next_meeting_venue: aiFields.next_meeting_venue || "",
      prepared_by_date: ctx.date || "",
      confirmed_by_name: "",
      confirmed_by_designation: "",
      confirmed_by_date: "",
    };
  },
};

// ---------- Site Meeting MOM ----------
// Note: real attendees aren't tracked by group (Employer/Consultant/Contractor)
// in this app, so all attendees are placed under "Employer / Client / Project
// Management" for now — move names between groups manually in Word if needed.
const SITE_SECTIONS = [
  { key: "section_2", prefix: "2.", label: "Contract / Financial Matters" },
  { key: "section_3", prefix: "3.", label: "Preliminaries" },
  { key: "section_4", prefix: "4.", label: "Technical & Progress Matters" },
  { key: "section_5", prefix: "5.", label: "Consultants' Matters" },
  { key: "section_6", prefix: "6.", label: "Health, Safety & Environment (HSE)" },
  { key: "section_7", prefix: "7.", label: "Others / AOB" },
];
const SITE_MEETING_MOM = {
  file: "site-meeting-mom.docx",
  label: "Site Progress Meeting",
  buildSchema() {
    return {
      type: "object",
      properties: {
        ...HEADER_COMMON_SCHEMA,
        contract_sum: { type: "string", description: "Contract sum amount (numbers only, no currency symbol) if mentioned, else empty string." },
        site_possession_date: { type: "string", description: "Date of site possession as DD/MM/YYYY if mentioned, else empty string." },
        original_completion_date: { type: "string", description: "Original completion date as DD/MM/YYYY if mentioned, else empty string." },
        eot_granted: { type: "string", description: "Extension of time granted (e.g. '14 days' or 'None') if mentioned, else empty string." },
        revised_completion_date: { type: "string", description: "Revised completion date as DD/MM/YYYY if mentioned, else empty string." },
        contract_period: { type: "string", description: "Contract period (e.g. '12 months') if mentioned, else empty string." },
        lad_amount: { type: "string", description: "Liquidated & ascertained damages amount per day (numbers only) if mentioned, else empty string." },
        performance_bond: { type: "string", description: "Performance bond reference/amount if mentioned, else empty string." },
        progress_planned: { type: "string", description: "Planned progress percent (number only) if mentioned, else empty string." },
        progress_actual: { type: "string", description: "Actual progress percent (number only) if mentioned, else empty string." },
        variance_delay: { type: "string", description: "Variance/delay (e.g. '-5 days') if mentioned, else empty string." },
        ...sectionsSchemaProps(SITE_SECTIONS),
      },
      required: [
        ...HEADER_COMMON_REQUIRED,
        "contract_sum",
        "site_possession_date",
        "original_completion_date",
        "eot_granted",
        "revised_completion_date",
        "contract_period",
        "lad_amount",
        "performance_bond",
        "progress_planned",
        "progress_actual",
        "variance_delay",
        ...SITE_SECTIONS.map((s) => s.key),
      ],
      additionalProperties: false,
    };
  },
  buildPromptExtra() {
    return `\n\nAlso extract, only if explicitly mentioned in the transcript (otherwise leave empty): contract sum, site possession date, original/revised completion dates, EOT granted, contract period, LAD amount, performance bond, planned/actual progress percentages, variance/delay.\n\nSort each discussion point into exactly one of these fixed sections (empty array if nothing applies):\n${sectionsPromptBlock(SITE_SECTIONS)}`;
  },
  mapData(aiFields, ctx) {
    const attendeeRows = attendeeRenderList(ctx.attendeeList, ["company", "designation"], { present: "present", absent: "absent" }).map((a) => ({
      name: a.name,
      company: "",
      designation: "",
      present_mark: a.status === "present" ? "X" : "",
      apology_mark: "",
      absent_mark: a.status === "absent" ? "X" : "",
    }));
    return {
      project: ctx.title || "",
      contract_no: "",
      meeting_no: "",
      date: ctx.date || "",
      time_start: aiFields.time_start || "",
      time_end: aiFields.time_end || "",
      venue: aiFields.venue || ctx.venue || "",
      so_name: "",
      so_company: "",
      reference_no: "",
      prepared_by_name: ctx.preparedByName,
      prepared_by_designation: "",
      distribution_list: ctx.attendeeNames ? `${ctx.attendeeNames} and apologies` : "All attendees",
      employer_attendees: attendeeRows,
      consultant_attendees: [],
      contractor_attendees: [],
      contract_sum: aiFields.contract_sum || "",
      site_possession_date: aiFields.site_possession_date || "",
      original_completion_date: aiFields.original_completion_date || "",
      eot_granted: aiFields.eot_granted || "",
      revised_completion_date: aiFields.revised_completion_date || "",
      contract_period: aiFields.contract_period || "",
      lad_amount: aiFields.lad_amount || "",
      performance_bond: aiFields.performance_bond || "",
      progress_planned: aiFields.progress_planned || "",
      progress_actual: aiFields.progress_actual || "",
      variance_delay: aiFields.variance_delay || "",
      ...sectionsRenderData(aiFields, SITE_SECTIONS),
      next_meeting_date: aiFields.next_meeting_date || ctx.nextMeetingDate || "",
      next_meeting_time: aiFields.next_meeting_time || "",
      next_meeting_venue: aiFields.next_meeting_venue || "",
      prepared_by_company: "",
      prepared_by_date: ctx.date || "",
      confirmed_by_name: "",
      confirmed_by_designation: "",
      confirmed_by_company: "",
      confirmed_by_date: "",
    };
  },
};

const TEMPLATES = {
  "general-mom": GENERAL_MOM,
  "ccm-mom": CCM_MOM,
  "ground-branding-mom": GROUND_BRANDING_MOM,
  "site-meeting-mom": SITE_MEETING_MOM,
};

export async function POST(request) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const { template, title, date, attendees, transcriptText, venue, nextMeetingDate } = body;

  const templateInfo = TEMPLATES[template];
  if (!templateInfo) {
    return Response.json({ error: `Unknown template "${template}"` }, { status: 400 });
  }
  if (!transcriptText || !transcriptText.trim()) {
    return Response.json({ error: "No transcript text provided." }, { status: 400 });
  }

  const attendeeList = (attendees || []).filter((a) => a.name);
  const attendeeNames = attendeeList.map((a) => a.name).join(", ");

  let aiFields;
  try {
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 8000,
      output_config: {
        format: {
          type: "json_schema",
          schema: templateInfo.buildSchema(),
        },
      },
      messages: [
        {
          role: "user",
          content: `You are drafting the content for a formal "Minutes of Meeting" Word document from a transcript.

Meeting: "${title || "Untitled meeting"}" on ${date || "unspecified date"}
Attendees: ${attendeeNames || "unspecified"}${templateInfo.buildPromptExtra()}

Transcript:
"""
${transcriptText.slice(0, 15000)}
"""`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock) return Response.json({ error: "No response from model." }, { status: 502 });
    aiFields = JSON.parse(textBlock.text);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 502 });
  }

  try {
    const templatePath = path.join(process.cwd(), "lib", "minutes-templates", templateInfo.file);
    const zip = new PizZip(fs.readFileSync(templatePath));
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

    const preparedByName = session.user?.name || session.user?.email || "";
    const renderData = templateInfo.mapData(aiFields, {
      title,
      date,
      venue,
      nextMeetingDate,
      attendeeList,
      attendeeNames,
      preparedByName,
    });

    doc.render(renderData);

    const buf = doc.getZip().generate({ type: "nodebuffer" });
    return new Response(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${(title || "minutes").replace(/[^a-z0-9]+/gi, "-")}.docx"`,
      },
    });
  } catch (err) {
    return Response.json({ error: `Could not fill template: ${err.message}` }, { status: 500 });
  }
}
