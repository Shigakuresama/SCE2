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
declare function getQueueStatus(): Promise<QueueStatus>;
declare function updateUI(): Promise<void>;
