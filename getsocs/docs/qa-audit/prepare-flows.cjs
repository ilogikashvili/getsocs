const fs=require('fs');const path=require('path');
let s=fs.readFileSync(path.join(__dirname,'../../e2e/critical-flows.spec.js'),'utf8');
s=s.replace("require('@playwright/test')","require('../../e2e/node_modules/@playwright/test')")
.replaceAll("'e2e.test.json'","'audit.test.json'")
.replaceAll("'fixtures/","'../../e2e/fixtures/")
.replaceAll('127.0.0.1:3001','127.0.0.1:3101')
.replaceAll("page.getByLabel('Password')","page.locator('input[name=password]')")
.replaceAll('/two-factor verification/i','/verify your identity/i')
.replace('test.describe.serial(', 'test.describe(')
.replace("name: 'E2E'", "name: 'Audit'")
.replace('expect(registration.status()).toBe(200)', 'expect(registration.status(), await registration.text()).toBe(200)');
fs.writeFileSync(path.join(__dirname,'adapted-flows.spec.js'),s);
