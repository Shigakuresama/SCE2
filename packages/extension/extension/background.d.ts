interface Config {
    apiBaseUrl: string;
    autoProcess: boolean;
    autoStart: boolean;
    pollInterval: number;
    timeout: number;
    maxConcurrent: number;
    debugMode: boolean;
}
interface ScrapeJob {
    id: number;
    streetNumber: string;
    streetName: string;
    zipCode: string;
    addressFull: string;
}
interface SubmitJob {
    id: number;
    streetNumber: string;
    streetName: string;
    zipCode: string;
    addressFull: string;
    customerName?: string;
    customerPhone?: string;
    customerAge?: number;
    fieldNotes?: string;
    documents: Array<{
        id: number;
        fileName: string;
        filePath: string;
        url: string;
        docType: string;
    }>;
}
interface QueueState {
    items: any[];
    currentJob: any;
    isProcessing: boolean;
    processedCount: number;
}
declare const SCRAPE_QUEUE: QueueState;
declare const SUBMIT_QUEUE: QueueState;
declare let pollTimer: number | null;
declare function getConfig(): Promise<Config>;
declare function log(...args: any[]): void;
declare function fetchWithTimeout(url: string, options?: RequestInit, timeout?: number): Promise<Response>;
declare function fetchScrapeJob(): Promise<ScrapeJob | null>;
declare function fetchSubmitJob(): Promise<SubmitJob | null>;
declare function processScrapeJob(job: ScrapeJob): Promise<void>;
declare function saveScrapedData(propertyId: number, data: {
    customerName: string;
    customerPhone: string;
}): Promise<void>;
declare function processSubmitJob(job: SubmitJob): Promise<void>;
declare function markJobComplete(propertyId: number, sceCaseId: string): Promise<void>;
declare function markJobFailed(propertyId: number, type: string, reason: string): Promise<void>;
declare function waitForTabLoad(tabId: number): Promise<void>;
declare function closeTab(tabId: number): Promise<void>;
declare function poll(): Promise<void>;
declare function startPolling(): Promise<void>;
declare function stopPolling(): void;
