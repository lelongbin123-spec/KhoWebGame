/**
 * Tải tệp cấu hình JSON của trò chơi
 */
export async function loadConfig(path = "data/data.json") {
  let response = await fetch(path).catch(() => null);
  if (!response || !response.ok) {
    const alternative = path.startsWith("../") ? path.slice(3) : `./${path}`;
    const altResponse = await fetch(alternative).catch(() => null);
    if (altResponse && altResponse.ok) {
      response = altResponse;
    }
  }
  if (!response || !response.ok) {
    throw new Error(`Không tải được tệp cấu hình ${path}`);
  }

  const config = await response.json();
  return config;
}
