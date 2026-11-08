import jsPDF from "jspdf";
import { CharacterBio } from "./generate-bio";
import { ROLES } from "./roles";

// Helper to draw clean vector PDF for printing or emailing
export function generateCharacterPdf(char: CharacterBio): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const roleMeta = ROLES[char.role];

  // Background - Dark Inked Ink-950 (#07080B)
  doc.setFillColor(7, 8, 11);
  doc.rect(0, 0, 210, 297, "F");

  // Outer Border - Brass line (#D8B45A)
  doc.setDrawColor(216, 180, 90);
  doc.setLineWidth(1);
  doc.rect(10, 10, 190, 277);

  // Inner Accent Line
  doc.setLineWidth(0.3);
  doc.rect(13, 13, 184, 271);

  // Header Banner
  doc.setFillColor(14, 16, 21);
  doc.rect(15, 18, 180, 32, "F");

  // Syndicate Accord Title
  doc.setTextColor(216, 180, 90);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("THE SYNDICATE ACCORD — OFFICIAL CHARACTER PORTAL", 105, 26, { align: "center" });

  // Character Name
  doc.setTextColor(242, 238, 230); // #F2EEE6
  doc.setFontSize(22);
  doc.text(char.fullName.toUpperCase(), 105, 36, { align: "center" });

  // Role Badge Chip
  // Convert hex color to RGB for jsPDF
  const roleRgb = hexToRgb(char.roleColor);
  doc.setFillColor(roleRgb.r, roleRgb.g, roleRgb.b);
  doc.roundedRect(65, 42, 80, 7, 2, 2, "F");

  doc.setTextColor(7, 8, 11);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`${char.roleName.toUpperCase()} • BADGE #${char.badgeCode}`, 105, 47, { align: "center" });

  // Flavour Line
  doc.setTextColor(185, 188, 198);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.text(`"${roleMeta.flavour}"`, 105, 56, { align: "center" });

  // Divider Line
  doc.setDrawColor(35, 40, 51);
  doc.line(20, 60, 190, 60);

  // Meta Specs Section
  doc.setFillColor(20, 23, 31);
  doc.rect(20, 65, 170, 30, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(154, 160, 174);
  doc.text("EMAIL:", 25, 73);
  doc.setTextColor(242, 238, 230);
  doc.text(char.email, 55, 73);

  doc.setTextColor(154, 160, 174);
  doc.text("FIELD / YEAR:", 25, 81);
  doc.setTextColor(242, 238, 230);
  doc.text(`${char.fieldOfStudy} (${char.year})`, 55, 81);

  doc.setTextColor(154, 160, 174);
  doc.text("TAGLINE:", 25, 89);
  doc.setTextColor(216, 180, 90);
  doc.text(`"${char.tagline}"`, 55, 89);

  // Origin Story Section Header
  doc.setTextColor(216, 180, 90);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("OPERATIONAL ORIGIN & CHARACTER DOSSIER", 20, 105);

  doc.setDrawColor(216, 180, 90);
  doc.line(20, 107, 190, 107);

  // Title / Codename
  doc.setTextColor(roleRgb.r, roleRgb.g, roleRgb.b);
  doc.setFontSize(14);
  doc.text(char.title, 20, 116);

  // Story Body (Word Wrap)
  doc.setTextColor(242, 238, 230);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const storyLines = doc.splitTextToSize(char.originStory, 170);
  doc.text(storyLines, 20, 124);

  let currentY = 124 + (storyLines.length * 5) + 8;

  // Speciality Box
  doc.setFillColor(20, 23, 31);
  doc.rect(20, currentY, 170, 22, "F");

  doc.setTextColor(216, 180, 90);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("FACTION SPECIALITY:", 25, currentY + 7);

  doc.setTextColor(242, 238, 230);
  doc.setFont("helvetica", "normal");
  const specLines = doc.splitTextToSize(char.speciality, 160);
  doc.text(specLines, 25, currentY + 14);

  currentY += 30;

  // Traits Section
  doc.setTextColor(216, 180, 90);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("IDENTIFIED OPERATIONAL TRAITS", 20, currentY);
  doc.line(20, currentY + 2, 190, currentY + 2);

  currentY += 8;

  char.traits.forEach((trait, i) => {
    doc.setFillColor(27, 31, 41);
    doc.rect(20 + (i * 56), currentY, 52, 12, "F");

    doc.setTextColor(242, 238, 230);
    doc.setFontSize(8);
    doc.text(`• ${trait}`, 23 + (i * 56), currentY + 7);
  });

  currentY += 22;

  // Faction Motto Footer
  doc.setFillColor(14, 16, 21);
  doc.rect(20, currentY, 170, 18, "F");

  doc.setTextColor(154, 160, 174);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("FACTION MOTTO", 105, currentY + 6, { align: "center" });

  doc.setTextColor(216, 180, 90);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.text(`"${char.motto}"`, 105, currentY + 13, { align: "center" });

  // Footer Note
  doc.setTextColor(107, 114, 128);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Issued by order of The Syndicate Accord Game Wardens • Non-transferable character record", 105, 280, { align: "center" });

  return doc;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleanHex = hex.replace("#", "");
  const bigint = parseInt(cleanHex, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}
