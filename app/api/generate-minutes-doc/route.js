import Anthropic from "@anthropic-ai/sdk";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import fs from "fs";
import path from "path";
import { auth } from "@/auth";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TEMPLATES = {
  "general-mom": {
    file: "general-mom.docx",
    label: "General Meeting MOM",
  },
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
          schema: {
            type: "object",
            properties: {
              chairperson_name: { type: "string", description: "Who chaired/led the meeting, if mentioned. Empty string if not stated." },
              venue: { type: "string", description: "Meeting venue/platform if mentioned (e.g. a room name, Zoom, MS Teams). Empty string if not stated." },
              time_start: { type: "string", description: "Meeting start time as HH:MM if mentioned, else empty string." },
              time_end: { type: "string", description: "Meeting end time as HH:MM if mentioned, else empty string." },
              next_meeting_date: { type: "string", description: "Next meeting date as DD/MM/YYYY if mentioned, else empty string." },
              next_meeting_time: { type: "string", description: "Next meeting time as HH:MM if mentioned, else empty string." },
              next_meeting_venue: { type: "string", description: "Next meeting venue if mentioned, else empty string." },
              matters: {
                type: "array",
                description:
                  "Rows for the MATTERS DISCUSSED table. Always include exactly these five category header rows in this order, each with matter set to the fixed label shown and action_by/target_date/status set to \"-\": item_no \"1.0\" matter \"Confirmation of Previous Minutes\"; item_no \"2.0\" matter \"Matters Arising\"; item_no \"3.0\" matter \"Agenda Items / New Matters\"; item_no \"4.0\" matter \"Any Other Business (AOB)\"; item_no \"5.0\" matter \"Date of Next Meeting\". Between/after each category header, insert detail rows (numbered 1.1, 1.2, 2.1, 3.1, 3.2, ... etc.) for whatever was actually discussed under that category, with action_by naming an attendee where mentioned, target_date as DD/MM/YYYY if mentioned else empty, and status one of Open/In Progress/Closed/Carried Forward. If nothing was discussed for a category, only its header row (with \"-\" placeholders) is included — do not invent detail rows.",
                items: {
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
                },
              },
            },
            required: [
              "chairperson_name",
              "venue",
              "time_start",
              "time_end",
              "next_meeting_date",
              "next_meeting_time",
              "next_meeting_venue",
              "matters",
            ],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: "user",
          content: `You are drafting the content for a formal "Minutes of Meeting" Word document from a transcript.

Meeting: "${title || "Untitled meeting"}" on ${date || "unspecified date"}
Attendees: ${attendeeNames || "unspecified"}

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

    doc.render({
      department: title || "",
      meeting_no: "",
      date: date || "",
      time_start: aiFields.time_start || "",
      time_end: aiFields.time_end || "",
      venue: aiFields.venue || venue || "",
      chairperson_name: aiFields.chairperson_name || "",
      prepared_by_name: preparedByName,
      reference_no: "",
      distribution_list: attendeeNames ? `${attendeeNames} and apologies` : "All attendees",
      attendees: attendeeList.map((a, i) => ({
        no: String(i + 1),
        name: a.name || "",
        designation: "",
        department_company: "",
        status: a.attended === false ? "Absent" : "Present",
      })),
      matters: aiFields.matters || [],
      next_meeting_date: aiFields.next_meeting_date || nextMeetingDate || "",
      next_meeting_time: aiFields.next_meeting_time || "",
      next_meeting_venue: aiFields.next_meeting_venue || "",
      prepared_by_designation: "",
      prepared_by_date: date || "",
      confirmed_by_name: "",
      confirmed_by_designation: "",
      confirmed_by_date: "",
    });

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
