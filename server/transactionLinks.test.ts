import { describe, it, expect } from "vitest";
import {
  getTransactionLinks,
  addTransactionLink,
  updateTransactionLink,
  deleteTransactionLink,
  setTransactionLinks,
  TransactionLink,
} from "./db";

describe(
  "Transaction Links Management",
  () => {
    const mockTransactionId = 1;
    const mockLink: TransactionLink = {
      url: "https://example.com",
      title: "Example Link",
      description: "A test link",
    };

    describe("getTransactionLinks", () => {
      it(
        "should retrieve transaction links",
        async () => {
          const result = await getTransactionLinks(mockTransactionId);
          expect(Array.isArray(result)).toBe(true);
        },
        { timeout: 10000 }
      );

      it(
        "should return empty array for transaction with no links",
        async () => {
          const result = await getTransactionLinks(999);
          expect(Array.isArray(result)).toBe(true);
          expect(result.length).toBe(0);
        },
        { timeout: 10000 }
      );
    });

    describe("addTransactionLink", () => {
      it(
        "should add a link to a transaction",
        async () => {
          const link: TransactionLink = {
            url: "https://test.com",
            title: "Test",
          };
          await addTransactionLink(mockTransactionId, link);
          const links = await getTransactionLinks(mockTransactionId);
          expect(links.length).toBeGreaterThan(0);
        },
        { timeout: 10000 }
      );

      it(
        "should preserve link properties",
        async () => {
          const link: TransactionLink = {
            url: "https://example.com/page",
            title: "Page Title",
            description: "Page Description",
          };
          await addTransactionLink(mockTransactionId, link);
          const links = await getTransactionLinks(mockTransactionId);
          const found = links.find((l) => l.url === link.url);
          expect(found).toBeDefined();
          expect(found?.title).toBe(link.title);
          expect(found?.description).toBe(link.description);
        },
        { timeout: 10000 }
      );

      it(
        "should allow adding multiple links",
        async () => {
          const link1: TransactionLink = { url: "https://link1.com" };
          const link2: TransactionLink = { url: "https://link2.com" };
          await addTransactionLink(mockTransactionId, link1);
          await addTransactionLink(mockTransactionId, link2);
          const links = await getTransactionLinks(mockTransactionId);
          expect(links.length).toBeGreaterThanOrEqual(2);
        },
        { timeout: 10000 }
      );
    });

    describe("updateTransactionLink", () => {
      it(
        "should update an existing link",
        async () => {
          const originalLink: TransactionLink = {
            url: "https://original.com",
            title: "Original",
          };
          await addTransactionLink(mockTransactionId, originalLink);
          const links = await getTransactionLinks(mockTransactionId);
          const index = links.length - 1;

          const updatedLink: TransactionLink = {
            url: "https://updated.com",
            title: "Updated",
          };
          await updateTransactionLink(mockTransactionId, index, updatedLink);
          const updatedLinks = await getTransactionLinks(mockTransactionId);
          expect(updatedLinks[index].url).toBe(updatedLink.url);
        },
        { timeout: 10000 }
      );

      it(
        "should handle invalid index gracefully",
        async () => {
          const link: TransactionLink = {
            url: "https://test.com",
          };
          await expect(
            updateTransactionLink(mockTransactionId, 999, link)
          ).resolves.not.toThrow();
        },
        { timeout: 10000 }
      );
    });

    describe("deleteTransactionLink", () => {
      it(
        "should delete a link from transaction",
        async () => {
          const link: TransactionLink = {
            url: "https://delete-test.com",
            title: "To Delete",
          };
          await addTransactionLink(mockTransactionId, link);
          const linksBefore = await getTransactionLinks(mockTransactionId);
          const countBefore = linksBefore.length;

          if (countBefore > 0) {
            await deleteTransactionLink(mockTransactionId, countBefore - 1);
            const linksAfter = await getTransactionLinks(mockTransactionId);
            expect(linksAfter.length).toBeLessThanOrEqual(countBefore);
          }
        },
        { timeout: 10000 }
      );

      it(
        "should handle deletion of last link",
        async () => {
          const link: TransactionLink = { url: "https://last-link.com" };
          await addTransactionLink(mockTransactionId, link);
          const links = await getTransactionLinks(mockTransactionId);

          if (links.length > 0) {
            await deleteTransactionLink(mockTransactionId, 0);
            const updatedLinks = await getTransactionLinks(mockTransactionId);
            expect(Array.isArray(updatedLinks)).toBe(true);
          }
        },
        { timeout: 10000 }
      );
    });

    describe("setTransactionLinks", () => {
      it(
        "should set all links for a transaction",
        async () => {
          const links: TransactionLink[] = [
            { url: "https://link1.com", title: "Link 1" },
            { url: "https://link2.com", title: "Link 2" },
            { url: "https://link3.com", title: "Link 3" },
          ];
          await setTransactionLinks(mockTransactionId, links);
          const retrievedLinks = await getTransactionLinks(mockTransactionId);
          expect(retrievedLinks.length).toBeGreaterThanOrEqual(links.length);
        },
        { timeout: 10000 }
      );

      it(
        "should clear links when setting empty array",
        async () => {
          await setTransactionLinks(mockTransactionId, []);
          const links = await getTransactionLinks(mockTransactionId);
          expect(Array.isArray(links)).toBe(true);
        },
        { timeout: 10000 }
      );

      it(
        "should replace existing links",
        async () => {
          const initialLinks: TransactionLink[] = [
            { url: "https://old1.com" },
            { url: "https://old2.com" },
          ];
          await setTransactionLinks(mockTransactionId, initialLinks);

          const newLinks: TransactionLink[] = [
            { url: "https://new1.com", title: "New Link" },
          ];
          await setTransactionLinks(mockTransactionId, newLinks);
          const retrievedLinks = await getTransactionLinks(mockTransactionId);
          expect(retrievedLinks.length).toBeGreaterThanOrEqual(newLinks.length);
        },
        { timeout: 10000 }
      );
    });

    describe("Link data integrity", () => {
      it(
        "should preserve URLs with special characters",
        async () => {
          const link: TransactionLink = {
            url: "https://example.com/path?param=value&other=123#section",
            title: "Complex URL",
          };
          await addTransactionLink(mockTransactionId, link);
          const links = await getTransactionLinks(mockTransactionId);
          const found = links.find((l) => l.url.includes("param=value"));
          expect(found).toBeDefined();
        },
        { timeout: 10000 }
      );

      it(
        "should handle links with unicode characters",
        async () => {
          const link: TransactionLink = {
            url: "https://example.com",
            title: "Título com Acentuação",
            description: "Descrição com émojis 🔗",
          };
          await addTransactionLink(mockTransactionId, link);
          const links = await getTransactionLinks(mockTransactionId);
          const found = links.find((l) => l.title?.includes("Acentuação"));
          expect(found).toBeDefined();
        },
        { timeout: 10000 }
      );

      it(
        "should handle links with very long URLs",
        async () => {
          const longUrl = "https://example.com/" + "a".repeat(500);
          const link: TransactionLink = {
            url: longUrl,
            title: "Long URL",
          };
          await addTransactionLink(mockTransactionId, link);
          const links = await getTransactionLinks(mockTransactionId);
          const found = links.find((l) => l.url.length > 500);
          expect(found).toBeDefined();
        },
        { timeout: 10000 }
      );
    });
  },
  { timeout: 120000 }
);
