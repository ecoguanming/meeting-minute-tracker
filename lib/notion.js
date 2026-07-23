const STATUS_TO_NOTION = {
  grey: "Not started",
  yellow: "In progress",
  green: "Completed",
  red: "Delayed",
};

export async function createNotionTask({ matter, actionParty, deadline, status, meetingTitle }) {
  const properties = {
    Name: { title: [{ text: { content: matter || "Untitled action item" } }] },
    Assignee: { rich_text: [{ text: { content: actionParty || "" } }] },
    Status: { status: { name: STATUS_TO_NOTION[status] || "Not started" } },
    Meeting: { rich_text: [{ text: { content: meetingTitle || "" } }] },
  };
  if (deadline) {
    properties["Due Date"] = { date: { start: deadline } };
  }

  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      parent: { database_id: process.env.NOTION_DATABASE_ID },
      properties,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Notion task creation failed");
  }
  return data;
}
