// Simple check that the serverless functions are running.
// Reports whether the Claude API key is configured, never the key itself.
export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    app: "givouch",
    anthropicKeyConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
  });
}
