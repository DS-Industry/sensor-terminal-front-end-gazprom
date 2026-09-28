import { axiosInstance } from "../../axiosConfig";
import { ITerminalConfigResponse } from "../../types/terminal";
import { logger } from "../../../util/logger";

enum TERMINAL {
  CONFIG = 'terminal-data/',
}

export async function getTerminalConfig(): Promise<ITerminalConfigResponse> {
  try {
    const response = await axiosInstance.get<ITerminalConfigResponse>(TERMINAL.CONFIG);
    logger.info('[TerminalConfig] Fetched terminal configuration', response.data);
    return response.data;
  } catch (error) {
    logger.error('[TerminalConfig] Failed to fetch terminal configuration', error);
    throw error;
  }
}
