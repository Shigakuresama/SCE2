interface OptionsConfig {
    apiBaseUrl: string;
    pollInterval: number;
    timeout: number;
    maxConcurrent: number;
    autoStart: boolean;
    debugMode: boolean;
}
declare function loadOptionsConfig(): Promise<OptionsConfig>;
declare function saveOptionsConfig(config: Partial<OptionsConfig>): Promise<void>;
declare function showStatus(message: string, isError?: boolean): void;
