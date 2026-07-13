const clientRepository = require("../repositories/clientRepository");

class ClientService {

    async create(userId, data) {

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

        return await clientRepository.findById(id);
    }

    async getAll(userId) {
        return await clientRepository.findByUser(userId);
    }

    async update(id, data) {

        await clientRepository.update(id, data);

        return await clientRepository.findById(id);
    }

    async delete(id) {

        await clientRepository.delete(id);

        return true;
    }

    async get(id, userId) {

        const client = await clientRepository.findById(id, userId);
    
        if (!client) {
            throw new Error("Client not found.");
        }
    
        return client;
    
    }

}

module.exports = new ClientService();