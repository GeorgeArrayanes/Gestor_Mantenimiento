export class ExternalNotificationService {
  async sendIncidentAssigned() {
    // Punto de extensión para WhatsApp Business Cloud API. No se simulan envíos.
    return { delivered: false, provider: null };
  }
}

export const externalNotifications = new ExternalNotificationService();
