import { Contact } from '@prisma/client';
import { prisma } from '@/app/lib/prisma';

export class ContactRepository {
  async findDirectMatches(email: string | null, phoneNumber: string | null): Promise<Contact[]> {
    const orConditions: any[] = [];
    if (email) orConditions.push({ email });
    if (phoneNumber) orConditions.push({ phoneNumber });

    if (orConditions.length === 0) return [];

    return prisma.contact.findMany({
      where: { OR: orConditions },
    });
  }

  async createNewPrimaryContact(email: string | null, phoneNumber: string | null): Promise<Contact> {
    return prisma.contact.create({
      data: {
        email,
        phoneNumber,
        linkPrecedence: 'primary',
      },
    });
  }

  async fetchFullCluster(primaryIds: number[]): Promise<Contact[]> {
    return prisma.contact.findMany({
      where: {
        OR: [
          { id: { in: primaryIds } },
          { linkedId: { in: primaryIds } },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async demoteNewerPrimaries(idsToDemote: number[], newPrimaryId: number): Promise<void> {
    if (idsToDemote.length === 0) return;

    await prisma.contact.updateMany({
      where: {
        OR: [
          { id: { in: idsToDemote } },
          { linkedId: { in: idsToDemote } }
        ]
      },
      data: {
        linkedId: newPrimaryId,
        linkPrecedence: 'secondary',
      },
    });
  }

  async appendNewSecondaryIfNeeded(
    clusterContacts: Contact[],
    email: string | null,
    phoneNumber: string | null,
    oldestPrimaryId: number
  ): Promise<Contact | null> {
    const existingEmails = new Set(clusterContacts.map(c => c.email).filter(Boolean));
    const existingPhones = new Set(clusterContacts.map(c => c.phoneNumber).filter(Boolean));

    const isNewEmail = email && !existingEmails.has(email);
    const isNewPhone = phoneNumber && !existingPhones.has(phoneNumber);

    if (isNewEmail || isNewPhone) {
      return prisma.contact.create({
        data: {
          email,
          phoneNumber,
          linkedId: oldestPrimaryId,
          linkPrecedence: 'secondary',
        },
      });
    }

    return null;
  }
}

export class IdentityService {
  private repository: ContactRepository;

  constructor() {
    this.repository = new ContactRepository();
  }

  public async resolveIdentity(email: string | null, phoneNumber: string | null) {
    if (!email && !phoneNumber) {
      throw new Error('Email or phone number is required');
    }

    // 1. Find all direct matches
    const matches = await this.repository.findDirectMatches(email, phoneNumber);

    if (matches.length === 0) {
      // Create new primary
      const newContact = await this.repository.createNewPrimaryContact(email, phoneNumber);
      return this.formatResponse([newContact], newContact.id);
    }

    // 2. We have matches. Find all related contacts in the "cluster"
    const primaryIds = Array.from(new Set(
      matches.map((c) => (c.linkPrecedence === 'primary' ? c.id : c.linkedId)).filter(Boolean) as number[]
    ));

    const allClusterContacts = await this.repository.fetchFullCluster(primaryIds);

    // 3. Identify the oldest primary contact and those to demote
    let primaryContacts = allClusterContacts.filter(c => c.linkPrecedence === 'primary');
    primaryContacts.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    // Fallback logic in case of anomalies
    const oldestPrimary = primaryContacts[0] || allClusterContacts.find(c => c.id === primaryIds[0]) || allClusterContacts[0];
    
    const primariesToDemote = primaryContacts.filter(c => c.id !== oldestPrimary.id);
    const contactsToDemoteIds = primariesToDemote.map(c => c.id);

    // 4. Update other primary contacts to secondary and re-link their secondaries
    if (contactsToDemoteIds.length > 0) {
      await this.repository.demoteNewerPrimaries(contactsToDemoteIds, oldestPrimary.id);
      // Refresh cluster state locally for accuracy
      allClusterContacts.forEach(c => {
        if (contactsToDemoteIds.includes(c.id) || (c.linkedId && contactsToDemoteIds.includes(c.linkedId))) {
          c.linkedId = oldestPrimary.id;
          c.linkPrecedence = 'secondary';
        }
      });
    }

    // 5. Check if we need to add a new secondary
    const newSecondary = await this.repository.appendNewSecondaryIfNeeded(allClusterContacts, email, phoneNumber, oldestPrimary.id);
    if (newSecondary) {
      allClusterContacts.push(newSecondary);
    }

    // Re-sort keeping oldest first
    allClusterContacts.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    // Generate output format
    const finalCluster = allClusterContacts.filter(c => c.id === oldestPrimary.id || c.linkedId === oldestPrimary.id);
    
    return this.formatResponse(finalCluster, oldestPrimary.id);
  }

  private formatResponse(finalCluster: Contact[], oldestPrimaryId: number) {
    const oldestPrimary = finalCluster.find(c => c.id === oldestPrimaryId)!;
    
    const emails = Array.from(new Set([
      oldestPrimary.email,
      ...finalCluster.map(c => c.email)
    ].filter(Boolean)));

    const phoneNumbers = Array.from(new Set([
      oldestPrimary.phoneNumber,
      ...finalCluster.map(c => c.phoneNumber)
    ].filter(Boolean)));

    const secondaryContactIds = finalCluster
      .filter(c => c.id !== oldestPrimaryId)
      .map(c => c.id);

    return {
      contact: {
        primaryContatctId: oldestPrimaryId,
        emails,
        phoneNumbers,
        secondaryContactIds,
      }
    };
  }
}
