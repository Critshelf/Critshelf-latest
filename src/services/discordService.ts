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
  try {
    const response = await fetch("/api/webhooks/custom-game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(gameData)
    });
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }
  } catch (error) {
    console.error("Error sending Discord notification through server API:", error);
  }
}
