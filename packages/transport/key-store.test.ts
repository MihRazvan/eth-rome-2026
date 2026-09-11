import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { BrowserKeyStore, generateRecipientKey } from './privacy';
it('reloads a non-extractable encryption key and reports permanent local key loss', async () => {
  const key = await generateRecipientKey();
  await new BrowserKeyStore().save('reload-test', key);
  const reloaded = await new BrowserKeyStore().load('reload-test');
  expect(reloaded?.publicKey).toBe(key.publicKey);
  expect(reloaded?.privateKey.extractable).toBe(false);
  await expect(crypto.subtle.exportKey('jwk', reloaded!.privateKey)).rejects.toThrow();
  await new BrowserKeyStore().remove('reload-test');
  expect(await new BrowserKeyStore().load('reload-test')).toBeUndefined();
});
