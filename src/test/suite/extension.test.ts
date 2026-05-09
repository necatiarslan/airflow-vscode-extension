import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { Session } from '../../common/Session';
// import * as myExtension from '../../extension';

class MockMemento implements vscode.Memento {
	private readonly store = new Map<string, any>();

	keys(): readonly string[] {
		return [...this.store.keys()];
	}

	get<T>(key: string): T | undefined;
	get<T>(key: string, defaultValue: T): T;
	get<T>(key: string, defaultValue?: T): T | undefined {
		if (this.store.has(key)) {
			return this.store.get(key) as T;
		}
		return defaultValue;
	}

	update(key: string, value: any): Thenable<void> {
		if (value === undefined) {
			this.store.delete(key);
		} else {
			this.store.set(key, value);
		}
		return Promise.resolve();
	}
}

class MockSecretStorage implements vscode.SecretStorage {
	private readonly secretMap = new Map<string, string>();
	private readonly emitter = new vscode.EventEmitter<vscode.SecretStorageChangeEvent>();
	public readonly onDidChange = this.emitter.event;

	public get(key: string): Thenable<string | undefined> {
		return Promise.resolve(this.secretMap.get(key));
	}

	public keys(): Thenable<string[]> {
		return Promise.resolve([...this.secretMap.keys()]);
	}

	public storeSecret(key: string, value: string): Thenable<void> {
		this.secretMap.set(key, value);
		this.emitter.fire({ key });
		return Promise.resolve();
	}

	public store(key: string, value: string): Thenable<void> {
		return this.storeSecret(key, value);
	}

	public delete(key: string): Thenable<void> {
		this.secretMap.delete(key);
		this.emitter.fire({ key });
		return Promise.resolve();
	}
}

function createMockContext(initialGlobalState?: Record<string, any>): vscode.ExtensionContext {
	const globalState = new MockMemento();
	if (initialGlobalState) {
		for (const [key, value] of Object.entries(initialGlobalState)) {
			void globalState.update(key, value);
		}
	}

	return {
		globalState,
		workspaceState: new MockMemento(),
		secrets: new MockSecretStorage(),
		extensionUri: vscode.Uri.parse('file:///mock-extension'),
		subscriptions: []
	} as unknown as vscode.ExtensionContext;
}

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});

	test('Session persists passwords in SecretStorage, not globalState', async () => {
		const context = createMockContext();
		const session = await Session.Create(context);

		const server = { apiUrl: 'http://localhost:8080/api/v2', apiUserName: 'admin', apiPassword: 'secret123' };
		session.AddServer(server);
		session.SetServer(server);

		await Promise.resolve();

		const storedServerList = context.globalState.get<{ apiUrl: string; apiUserName: string; apiPassword?: string }[]>('serverList') || [];
		assert.strictEqual(storedServerList.length, 1);
		assert.strictEqual(storedServerList[0].apiPassword, undefined);
		assert.strictEqual(context.globalState.get('apiPassword'), undefined);

		const reloadedSession = await Session.Create(context);
		assert.strictEqual(reloadedSession.Server?.apiPassword, 'secret123');
		assert.strictEqual(reloadedSession.GetServer('http://localhost:8080/api/v2', 'admin')?.apiPassword, 'secret123');

		reloadedSession.dispose();
		session.dispose();
	});

	test('Session migrates legacy globalState passwords to SecretStorage', async () => {
		const context = createMockContext({
			apiUrl: 'http://localhost:8080/api/v2',
			apiUserName: 'legacy-user',
			apiPassword: 'legacy-secret',
			serverList: [{ apiUrl: 'http://localhost:8080/api/v2', apiUserName: 'legacy-user', apiPassword: 'legacy-secret' }]
		});

		const session = await Session.Create(context);

		assert.strictEqual(session.Server?.apiPassword, 'legacy-secret');
		assert.strictEqual(session.GetServer('http://localhost:8080/api/v2', 'legacy-user')?.apiPassword, 'legacy-secret');
		assert.strictEqual(context.globalState.get('apiPassword'), undefined);

		const storedServerList = context.globalState.get<{ apiUrl: string; apiUserName: string; apiPassword?: string }[]>('serverList') || [];
		assert.strictEqual(storedServerList[0].apiPassword, undefined);

		session.dispose();
	});
});
