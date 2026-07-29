const clientRepository = require("../repositories/clientRepository");
const usageService = require("./usageService");

class ClientService {

    async create(userId, data) {
        await usageService.checkClientLimit(userId);

        const id = await clientRepository.create({
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

        await usageService.incrementClients(userId);

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
