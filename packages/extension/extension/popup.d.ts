interface ExtensionConfig {
    apiBaseUrl: string;
    pollInterval: number;
    autoProcess: boolean;
}
interface QueueStatus {
    scrapeCount: number;
    submitCount: number;
    isProcessing: boolean;
}
declare function loadPopupConfig(): Promise<ExtensionConfig>;
declare function savePopupConfig(config: ExtensionConfig): Promise<void>;
declare function getQueueStatus(): Promise<QueueStatus>;
declare function updateUI(): Promise<void>;
