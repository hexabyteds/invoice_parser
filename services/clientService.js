const clientRepository = require("../repositories/clientRepository");
const usageService = require("./usageService");
const auditLogRepository = require("../repositories/auditLogRepository");

class ClientService {

    async create(userId, data) {
        if (!data.company_name || !data.company_name.trim()) {
            throw new Error("Company name is required.");
        }

        const duplicate = await clientRepository.findByCompanyName(
            userId,
            data.company_name.trim()
        );

        if (duplicate) {
            throw new Error("A client with this company name already exists.");
        }

        // Reserves the slot atomically — under concurrent requests, the old
        // checkClientLimit()-then-incrementClients() pair let every request
        // read the same pre-increment count and all pass, so N concurrent
        // requests near the limit could all succeed past it.
        await usageService.reserveClientSlot(userId);

        let id;

        try {
            id = await clientRepository.create({
                user_id: userId,
                company_name: data.company_name,
                contact_person: data.contact_person || "",
                email: data.email || "",
                phone: data.phone || "",
                trn: data.trn || "",
                address: data.address || "",
                country: data.country || "",
                city: data.city || "",
                notes: data.notes || ""
            });
        } catch (err) {
            // Creation failed after the slot was reserved — release it.
            await usageService.decrementClients(userId);
            throw err;
        }

        // Activity feed is a nice-to-have — never let logging break client creation.
        try {
            await auditLogRepository.create({
                userId,
                clientId: id,
                action: "client_added",
                description: data.company_name,
            });
        } catch (err) {
            // ignore
        }

        return await clientRepository.findById(id, userId);
    }

    async getAll(userId) {
        return await clientRepository.findByUser(userId);
    }

    async update(id, userId, data) {

        const existing = await clientRepository.findById(id, userId);

        if (!existing) {
            throw new Error("Client not found.");
        }

        const nextName = data.company_name ?? existing.company_name;

        if (nextName && nextName.trim()) {
            const duplicate = await clientRepository.findByCompanyName(
                userId,
                nextName.trim(),
                id
            );

            if (duplicate) {
                throw new Error("A client with this company name already exists.");
            }
        }

        const merged = {
            company_name: data.company_name ?? existing.company_name,
            contact_person: data.contact_person ?? existing.contact_person,
            email: data.email ?? existing.email,
            phone: data.phone ?? existing.phone,
            trn: data.trn ?? existing.trn,
            address: data.address ?? existing.address,
            country: data.country ?? existing.country,
            city: data.city ?? existing.city,
            notes: data.notes ?? existing.notes,
        };

        await clientRepository.update(id, userId, merged);

        return await clientRepository.findById(id, userId);
    }

    async get(id, userId) {

        const client = await clientRepository.findById(id, userId);
    
        if (!client) {
            throw new Error("Client not found.");
        }
    
        return client;
    
    }

    async updateStatus(id, userId, status) {

        const existing = await clientRepository.findById(id, userId);

        if (!existing) {
            throw new Error("Client not found.");
        }

        await clientRepository.updateStatus(id, userId, status);

        return await clientRepository.findById(id, userId);
    }

    // Guards the invoice/document creation path — throws (with a 403
    // statusCode) if the client has been deactivated, so a stale upload
    // form or a direct API call can't add documents to it.
    async assertActive(id, userId) {

        const client = await clientRepository.findById(id, userId);

        if (!client) {
            throw new Error("Client not found.");
        }

        if (client.status !== "ACTIVE") {
            const err = new Error(
                "This client is inactive. Please activate the client before adding documents."
            );
            err.statusCode = 403;
            throw err;
        }

        return client;
    }

    async delete(id, userId) {

        const client = await clientRepository.findById(id, userId);
    
        if (!client) {
            throw new Error("Client not found.");
        }
    
        await clientRepository.delete(id, userId);
    
        await usageService.decrementClients(userId);
    
        return true;
    }
}

module.exports = new ClientService();
