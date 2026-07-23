import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const { title, date, attendees, transcriptText } = body;

  if (!transcriptText || !transcriptText.trim()) {
    return Response.json({ error: "No transcript text provided." }, { status: 400 });
  }

  const attendeeNames = (attendees || []).map((a) => a.name || a.email).filter(Boolean).join(", ");

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
              professional_minutes: {
                type: "string",
                description:
                  "A well-written, professional meeting-minutes narrative with sections like MEETING OVERVIEW, KEY DISCUSSION POINTS, and DECISIONS. Do not list action items here.",
              },
              matters: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    matter: { type: "string", description: "Short description of the task/matter needing action" },
                    action_party: {
                      type: "string",
                      description: "Name of the person responsible, matching one of the attendees if possible",
                    },
                    deadline: {
                      type: "string",
                      description: "YYYY-MM-DD if a date was mentioned, otherwise empty string",
                    },
                  },
                  required: ["matter", "action_party", "deadline"],
                  additionalProperties: false,
                },
              },
            },
            required: ["professional_minutes", "matters"],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: "user",
          content: `You are drafting professional meeting minutes from a transcript.

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
    if (!textBlock) {
      return Response.json({ error: "No response from model." }, { status: 502 });
    }
    const parsed = JSON.parse(textBlock.text);
    return Response.json(parsed);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 502 });
  }
}
