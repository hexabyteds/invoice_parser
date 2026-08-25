const { request, app, registerAndLogin, authed } = require("../helpers/api");

async function createClient(token, overrides = {}) {
  return request(app)
    .post("/api/customers")
    .set(authed(token))
    .send({
      company_name: "Test Co",
      contact_person: "Jane Doe",
      email: "jane@testco.test",
      phone: "+1234567890",
      trn: "TRN-001",
      address: "123 Test St",
      country: "UAE",
      city: "Dubai",
      notes: "VIP",
      ...overrides,
    });
}

describe("Customers", () => {
  describe("CRUD happy path", () => {
    it("creates a customer and stores every field in its correct column", async () => {
      const { token } = await registerAndLogin();

      const res = await createClient(token);

      expect(res.status).toBe(201);
      const client = res.body.customer;
      expect(client.company_name).toBe("Test Co");
      expect(client.contact_person).toBe("Jane Doe");
      expect(client.email).toBe("jane@testco.test");
      expect(client.phone).toBe("+1234567890");
      expect(client.trn).toBe("TRN-001");
      expect(client.address).toBe("123 Test St");
      expect(client.country).toBe("UAE");
      expect(client.city).toBe("Dubai");
      expect(client.notes).toBe("VIP");
    });

    it("lists only the requesting user's customers", async () => {
      const { token } = await registerAndLogin();
      await createClient(token, { company_name: "Alpha" });
      await createClient(token, { company_name: "Beta" });

      const res = await request(app).get("/api/customers").set(authed(token));

      expect(res.status).toBe(200);
      expect(res.body.customers).toHaveLength(2);
    });

    it("gets a single customer by id", async () => {
      const { token } = await registerAndLogin();
      const created = await createClient(token);

      const res = await request(app)
        .get(`/api/customers/${created.body.customer.id}`)
        .set(authed(token));

      expect(res.status).toBe(200);
      expect(res.body.customer.company_name).toBe("Test Co");
    });

    it("updates a customer and persists every changed field", async () => {
      const { token } = await registerAndLogin();
      const created = await createClient(token);

      const res = await request(app)
        .put(`/api/customers/${created.body.customer.id}`)
        .set(authed(token))
        .send({
          company_name: "Updated Co",
          contact_person: "John Doe",
          email: "john@updated.test",
          phone: "+19999999999",
          trn: "TRN-999",
          address: "456 New St",
          country: "USA",
          city: "NYC",
          notes: "Updated notes",
        });

      expect(res.status).toBe(200);
      expect(res.body.customer.company_name).toBe("Updated Co");
      expect(res.body.customer.trn).toBe("TRN-999");
      expect(res.body.customer.country).toBe("USA");
      expect(res.body.customer.city).toBe("NYC");
      expect(res.body.customer.address).toBe("456 New St");
    });

    it("deletes a customer", async () => {
      const { token } = await registerAndLogin();
      const created = await createClient(token);

      const del = await request(app)
        .delete(`/api/customers/${created.body.customer.id}`)
        .set(authed(token));

      expect(del.status).toBe(200);

      const get = await request(app)
        .get(`/api/customers/${created.body.customer.id}`)
        .set(authed(token));

      expect(get.status).toBe(404);
    });
  });

  describe("Validation", () => {
    it("rejects creating a customer with no company_name", async () => {
      const { token } = await registerAndLogin();

      const res = await createClient(token, { company_name: undefined });

      expect(res.status).toBe(400);
    });
  });

  describe("Cross-user isolation (IDOR regression)", () => {
    it("blocks user B from reading user A's customer", async () => {
      const userA = await registerAndLogin();
      const userB = await registerAndLogin();
      const created = await createClient(userA.token);

      const res = await request(app)
        .get(`/api/customers/${created.body.customer.id}`)
        .set(authed(userB.token));

      expect(res.status).toBe(404);
    });

    it("blocks user B from updating user A's customer", async () => {
      const userA = await registerAndLogin();
      const userB = await registerAndLogin();
      const created = await createClient(userA.token, {
        company_name: "Owned By A",
      });

      const attack = await request(app)
        .put(`/api/customers/${created.body.customer.id}`)
        .set(authed(userB.token))
        .send({ company_name: "Hijacked By B" });

      expect(attack.status).toBe(404);

      const stillA = await request(app)
        .get(`/api/customers/${created.body.customer.id}`)
        .set(authed(userA.token));

      expect(stillA.body.customer.company_name).toBe("Owned By A");
    });

    it("blocks user B from deleting user A's customer", async () => {
      const userA = await registerAndLogin();
      const userB = await registerAndLogin();
      const created = await createClient(userA.token);

      const attack = await request(app)
        .delete(`/api/customers/${created.body.customer.id}`)
        .set(authed(userB.token));

      // Was 500 (BUG-CLIENT-001) — a not-found/not-owned customer is a 404,
      // same as every other customer endpoint (see the PUT test above).
      expect(attack.status).toBe(404);
      expect(attack.body.error).toBe("Customer not found.");

      const stillThere = await request(app)
        .get(`/api/customers/${created.body.customer.id}`)
        .set(authed(userA.token));

      expect(stillThere.status).toBe(200);
    });
  });

  describe("Customer limit enforcement", () => {
    it("blocks creating a customer past the plan's customer_limit", async () => {
      // Seeded Free plan has customer_limit: 2 (tests/setup/globalSetup.js)
      const { token } = await registerAndLogin();

      const first = await createClient(token, { company_name: "One" });
      const second = await createClient(token, { company_name: "Two" });
      const third = await createClient(token, { company_name: "Three" });

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(third.status).toBe(400);
      expect(third.body.error).toMatch(/limit reached/i);
    });
  });
});
