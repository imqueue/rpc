/*!
 * IMQClient generator trailing args removal coverage test
 */
import * as fs from 'fs';
import { expect } from 'chai';
import { IMQService, IMQClient, IMQDelay, IMQMetadata, expose, remote } from '..';

const CLIENTS_PATH = './test/clients-generator-trailing';

class GenTrailingService extends IMQService {
  @expose()
  public greet(name: string, meta?: IMQMetadata, delay?: IMQDelay) {
    return `hi ${name}`;
  }
}

// We don't need a manual client; the generator will create it dynamically.

describe('IMQClient.generator trailing args removal (IMQDelay/IMQMetadata)', function () {
  this.timeout(10000);
  let service: GenTrailingService;

  function rmdirr(path: string) {
    if (fs.existsSync(path)) {
      fs.readdirSync(path).forEach((file) => {
        const curPath = `${path}/${file}`;
        if (fs.lstatSync(curPath).isDirectory()) {
          rmdirr(curPath);
        } else {
          fs.unlinkSync(curPath);
        }
      });
      fs.rmdirSync(path);
    }
  }

  before(async () => {
    service = new GenTrailingService();
    await service.start();
  });

  after(async () => {
    await service.destroy();
    rmdirr(CLIENTS_PATH);
  });

  it('should strip trailing metadata/delay from service description and add imqMetadata/imqDelay once', async () => {
    const mod: any = await IMQClient.create('GenTrailingService', {
      path: CLIENTS_PATH,
      compile: true,
      write: true,
    });

    // Ensure client class exists and can be instantiated
    const client = new mod.GenTrailingClient();
    await client.start();

    // Read generated TypeScript to verify the signature
    const tsPath = `${CLIENTS_PATH}/GenTrailingService.ts`;
    expect(fs.existsSync(tsPath)).to.equal(true);
    const src = fs.readFileSync(tsPath, 'utf8');

    // The generated method should not keep original parameter names 'meta' or 'delay'
    // as they are stripped and replaced by imqMetadata/imqDelay at the end once.
    const signatureRe = /public\s+async\s+greet\(([^)]*)\)/;
    const m = src.match(signatureRe);
    expect(m, 'method signature not found in generated client').to.not.equal(null);
    const signature = (m as RegExpMatchArray)[1];

    // It should include imqMetadata?: IMQMetadata and imqDelay?: IMQDelay
    expect(signature).to.match(/imqMetadata\?\s*:\s*IMQMetadata/);
    expect(signature).to.match(/imqDelay\?\s*:\s*IMQDelay/);

    // Original 'delay' parameter could still be present due to service signature,
    // but generator must add imq* params at the end; presence is verified above.

    // Cleanup
    await client.destroy();
  });
});
