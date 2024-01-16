import axios from 'axios';
import { Authorizer } from '../index';
import { basicModelStr, hierarchicalRbacModelStr } from './models';
import { basicPolicies, hierarchicalRbacPolicies } from './policies';
import { removeLocalStorage } from '../Cache';
import TestServer from './server';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

test('Mock functions', () => {
    // Basic model
    const basicResponseObj = {
        m: basicModelStr,
        p: basicPolicies,
    };
    const basicModelResponse = { data: { message: 'ok', data: JSON.stringify(basicResponseObj) } };

    // Hierarchical model
    const hierarchicalResponseObj = {
        m: hierarchicalRbacModelStr,
        p: hierarchicalRbacPolicies,
    };
    const hierarchicalModelResponse = { data: { message: 'ok', data: JSON.stringify(hierarchicalResponseObj) } };

    // Specify the returned data of the mockedAxios once
    mockedAxios.get
        .mockImplementationOnce(() => Promise.resolve(basicModelResponse))
        .mockImplementationOnce(() => Promise.resolve(hierarchicalModelResponse));
    // TODO: Use mock function to get response object
    // const authorizer = new Authorizer('http://localhost:4000');
    // authorizer.setUser('alice');
    // expect(authorizer.getPermission()).toMatchObject(respObj);

    // expect(mockedAxios.get('http://localhost:4000/api/permissions?subject=alice')).toMatchObject(respObj);
});

async function checkSimpleModel(authorizer: Authorizer) {
    // can
    expect(await authorizer.can('read', 'data1')).toBe(true);
    expect(await authorizer.can('read', 'data4')).toBe(false);
    expect(await authorizer.can('write', 'data1')).toBe(false);
    // cannot
    expect(await authorizer.cannot('read', 'data4')).toBe(true);
    expect(await authorizer.cannot('read', 'data1')).toBe(false);
    // canAll
    expect(await authorizer.canAll('read', ['data1', 'data2'])).toBe(true);
    expect(await authorizer.canAll('write', ['data1', 'data2'])).toBe(false);
    expect(await authorizer.canAll('read', ['data1', 'data2', 'data4'])).toBe(false);
    // canAny
    expect(await authorizer.canAny('read', ['data1', 'data2'])).toBe(true);
    expect(await authorizer.canAny('write', ['data1', 'data2'])).toBe(true);
    expect(await authorizer.canAny('read', ['data1', 'data2', 'data4'])).toBe(true);
    expect(await authorizer.canAny('read', ['data4'])).toBe(false);
}

async function checkHierarchicalModel(authorizer: Authorizer) {
    // Tests for policy 1: [p, alice, subscription-reader, subscription1]
    expect(await authorizer.can('resource-group-read', 'resource-group1')).toBe(true);
    expect(await authorizer.can('resource-group-write', 'resource-group1')).toBe(false);
    expect(await authorizer.can('subscription-read', 'subscription1')).toBe(true);
    expect(await authorizer.can('subscription-write', 'subscription1')).toBe(false);
    expect(await authorizer.can('resource-group-read', 'resource-group5')).toBe(true);
    expect(await authorizer.can('resourcer-group-write', 'resource-group5')).toBe(false);

    // Tests for policy 2: [p, alice, resource-group-owner, resource-group2]
    expect(await authorizer.can('resource-group-read', 'resource-group2')).toBe(true);
    expect(await authorizer.can('resource-group-write', 'resource-group2')).toBe(true);
    expect(await authorizer.can('subscription-read', 'subscription2')).toBe(false);
    expect(await authorizer.can('subscription-write', 'subscription2')).toBe(false);

    // Tests for policy 3: [p, alice, subscription-owner, subscription3]
    expect(await authorizer.can('resource-group-read', 'resource-group3')).toBe(true);
    expect(await authorizer.can('resource-group-write', 'resource-group3')).toBe(true);
    expect(await authorizer.can('resource-group-read', 'resource-group4')).toBe(true);
    expect(await authorizer.can('resource-group-write', 'resource-group4')).toBe(true);
    expect(await authorizer.can('subscription-read', 'subscription3')).toBe(true);
    expect(await authorizer.can('subscription-write', 'subscription3')).toBe(true);
}

const permissionObj = {
    read: ['data1', 'data2'],
    write: ['data2'],
};

// test('Cookies mode', () => {
//     const permissionObj = {
//         read: ['data1', 'data2', 'data3'],
//         write: ['data1']
//     }
//     const cookieKey = 'test_perm'
//     Cookies.set('test_perm', JSON.stringify(permissionObj));
//     const authorizer = new Authorizer('cookies', {cookieKey: cookieKey});
//     check(authorizer);
// })

test('Manual mode', () => {
    const authorizer = new Authorizer('manual');
    authorizer.setPermission(permissionObj);
    checkSimpleModel(authorizer);
});

test('Auto mode', async () => {
    const respData = JSON.stringify({
        m: basicModelStr,
        p: basicPolicies,
    });
    const authorizer = new Authorizer('auto', { endpoint: 'whatever' });
    removeLocalStorage('alice');
    await authorizer.initEnforcer(respData);
    authorizer.user = 'alice';
    await checkSimpleModel(authorizer);
});

describe('Auto mode with server', () => {
    let server: TestServer;
    beforeAll(async () => {
        server = new TestServer();
        await server.start();
    });
    afterAll(() => server.terminate());

    test('Request for /api/permissions for simple model', async () => {
        removeLocalStorage('alice');
        const authorizer = new Authorizer('auto', { endpoint: 'http://localhost:4000/api/permissions' });
        await authorizer.setUser('alice');
        await checkSimpleModel(authorizer);
    });

    test('Request for /api/permissions for hierarchical model', async () => {
        removeLocalStorage('alice');
        const authorizer = new Authorizer('auto', { endpoint: 'http://localhost:4000/api/permissions' });
        await authorizer.setUser('alice');
        await checkHierarchicalModel(authorizer);
    });
});
