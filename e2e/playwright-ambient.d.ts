declare module '@playwright/test' {
  export interface PlaywrightTestConfig {
    testDir?: string;
    timeout?: number;
    expect?: { timeout?: number };
    fullyParallel?: boolean;
    forbidOnly?: boolean;
    retries?: number;
    workers?: number | string;
    reporter?: unknown;
    use?: {
      baseURL?: string;
      trace?: string;
      screenshot?: string;
      video?: string;
      reducedMotion?: 'reduce' | 'no-preference';
      actionTimeout?: number;
      navigationTimeout?: number;
    };
    projects?: Array<{
      name: string;
      use?: Record<string, unknown>;
      testMatch?: string | RegExp | Array<string | RegExp>;
      dependencies?: string[];
      fullyParallel?: boolean;
    }>;
    webServer?: {
      command: string;
      url: string;
      reuseExistingServer?: boolean;
      timeout?: number;
    };
  }

  export function defineConfig(config: PlaywrightTestConfig): PlaywrightTestConfig;

  export interface Locator {
    click(): Promise<void>;
    fill(value: string): Promise<void>;
    textContent(): Promise<string | null>;
    isVisible(): Promise<boolean>;
    waitFor(options?: { state?: 'attached' | 'detached' | 'visible' | 'hidden'; timeout?: number }): Promise<void>;
    count(): Promise<number>;
  }

  export interface Page {
    goto(url: string, options?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' }): Promise<unknown>;
    locator(selector: string): Locator;
    waitForSelector(selector: string, options?: { state?: 'attached' | 'detached' | 'visible' | 'hidden'; timeout?: number }): Promise<Locator | null>;
    waitForLoadState(state?: 'load' | 'domcontentloaded' | 'networkidle'): Promise<void>;
    getByRole(role: string, options?: { name?: string | RegExp }): Locator;
    getByText(text: string | RegExp): Locator;
    getByLabel(label: string | RegExp): Locator;
    getByPlaceholder(placeholder: string | RegExp): Locator;
    getByTestId(testId: string): Locator;
  }

  export interface DescribeMethod {
    (title: string, fn: () => void): void;
    serial(title: string, fn: () => void): void;
  }

  export interface TestType<TestArgs, WorkerArgs> {
    (title: string, testFunction: (args: TestArgs & WorkerArgs) => Promise<void> | void): void;
    only(title: string, testFunction: (args: TestArgs & WorkerArgs) => Promise<void> | void): void;
    skip(title: string, testFunction: (args: TestArgs & WorkerArgs) => Promise<void> | void): void;
    describe: DescribeMethod;
    beforeEach(fn: (args: TestArgs & WorkerArgs) => Promise<void> | void): void;
    afterEach(fn: (args: TestArgs & WorkerArgs) => Promise<void> | void): void;
    beforeAll(fn: (args: WorkerArgs) => Promise<void> | void): void;
    afterAll(fn: (args: WorkerArgs) => Promise<void> | void): void;
    extend<T>(fixtures: unknown): TestType<TestArgs & T, WorkerArgs>;
  }

  export const test: TestType<{ page: Page }, Record<string, unknown>>;

  export interface Matchers<R> {
    toBe(expected: unknown): R;
    toEqual(expected: unknown): R;
    toBeTruthy(): R;
    toBeFalsy(): R;
    toBeVisible(options?: { timeout?: number }): Promise<R>;
    toBeHidden(options?: { timeout?: number }): Promise<R>;
    toHaveCount(expected: number, options?: { timeout?: number }): Promise<R>;
    toHaveText(expected: string | RegExp, options?: { timeout?: number }): Promise<R>;
    toContainText(expected: string | RegExp, options?: { timeout?: number }): Promise<R>;
    not: Matchers<R>;
  }

  export interface Expect {
    <T = unknown>(actual: T): Matchers<void>;
    poll<T = unknown>(fn: () => Promise<T> | T, options?: { message?: string; timeout?: number; intervals?: number[] }): Matchers<Promise<void>>;
  }

  export const expect: Expect;
}
