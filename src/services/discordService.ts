export async function notifyNewGameSubmission(gameData: {
  id: string;
  title: string;
  minPlayers: number;
  maxPlayers: number;
  playTime: number;
  coverImage: string;
  submittedBy: string;
  userId: string;
}) {
  const webhookUrl = import.meta.env.VITE_DISCORD_GAME_WEBHOOK;
  if (!webhookUrl) {
    console.warn("Discord Webhook URL not found (VITE_DISCORD_GAME_WEBHOOK). Skipping notification.");
    return;
  }

  const payload = {
    embeds: [
      {
        title: "🎲 New Game Submission Pending Approval",
        description: "A user has submitted a new game to the database. Review and approve it in the admin panel.",
        color: 0xf59e0b, // Gold/Amber color for pending
        fields: [
          { name: "Title", value: gameData.title, inline: true },
          { name: "Players", value: `${gameData.minPlayers}-${gameData.maxPlayers}`, inline: true },
          { name: "Playtime", value: `${gameData.playTime} mins`, inline: true },
          { name: "Submitted By", value: `${gameData.submittedBy}`, inline: true },
          { name: "User ID", value: gameData.userId, inline: true },
          { name: "Firestore ID", value: `\`${gameData.id}\``, inline: false },
          { name: "Image URL", value: gameData.coverImage || "No image provided" }
        ],
        image: { url: gameData.coverImage || undefined },
        timestamp: new Date().toISOString(),
        footer: { text: "Dice-20 Moderation Bot" }
      }
    ]
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`Discord API returned ${response.status}`);
    }
  } catch (error) {
    console.error("Error sending Discord notification:", error);
  }
}
