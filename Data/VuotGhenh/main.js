import { loadConfig } from "./js/configLoader.js";
import { Game } from "./js/game.js";

/**
 * Khởi động trò chơi
 */
async function bootstrap() {
  try {
    const config = await loadConfig("data/data.json");
    const game = new Game(config);
    game.init();
  } catch (error) {
    console.error("Không thể khởi tạo Vượt Ghềnh:", error);
    document.body.innerHTML = `
      <main style="max-width:650px;margin:60px auto;padding:24px;font-family:Arial,sans-serif">
        <h1>Không tải được dữ liệu game</h1>
        <p>Hãy chạy dự án bằng Live Server trong Visual Studio Code hoặc một máy chủ web cục bộ.</p>
        <pre>${String(error.message).replaceAll("<", "&lt;")}</pre>
      </main>`;
  }
}

bootstrap();
