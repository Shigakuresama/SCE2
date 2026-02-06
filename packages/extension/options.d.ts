interface OptionsConfig {
    apiBaseUrl: string;
    pollInterval: number;
    timeout: number;
    maxConcurrent: number;
    autoStart: boolean;
    debugMode: boolean;
}
declare function showStatus(message: string, isError?: boolean): void;
