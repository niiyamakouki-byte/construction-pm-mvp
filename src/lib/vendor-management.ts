/**
 * Vendor management — ratings, history, and reliability scoring.
 */

export type VendorRating = {
  score: number; // 1-5
  review: string;
  ratedAt: string;
};

export type Vendor = {
  id: string;
  name: string;
  skills: string[];
  ratings: VendorRating[];
  projects: string[]; // project IDs
  createdAt: string;
};

export type VendorReliabilityScore = {
  vendorId: string;
  averageRating: number;
  totalProjects: number;
  reliability: number; // 0-100
};

// In-memory store for demo / testing
const vendors: Map<string, Vendor> = new Map();

export function addVendor(vendor: Vendor): Vendor {
  vendors.set(vendor.id, vendor);
  return vendor;
}

export function getVendor(id: string): Vendor | undefined {
  return vendors.get(id);
}

export function rateVendor(
  id: string,
  score: number,
  review: string,
): VendorRating | null {
  const vendor = vendors.get(id);
  if (!vendor) return null;
  const rating: VendorRating = {
    score: Math.max(1, Math.min(5, score)),
    review,
    ratedAt: new Date().toISOString(),
  };
  vendor.ratings.push(rating);
  return rating;
}

export function getVendorHistory(id: string): string[] {
  const vendor = vendors.get(id);
  return vendor ? [...vendor.projects] : [];
}

export function calculateVendorReliability(
  vendor: Vendor,
): VendorReliabilityScore {
  const ratings = vendor.ratings;
  const avg =
    ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length
      : 0;
  // reliability = weighted average rating * project count factor (max 100)
  const projectFactor = Math.min(vendor.projects.length / 5, 1);
  const reliability = Math.round(avg * 20 * projectFactor);
  return {
    vendorId: vendor.id,
    averageRating: Math.round(avg * 100) / 100,
    totalProjects: vendor.projects.length,
    reliability: Math.min(reliability, 100),
  };
}

export function findBestVendor(
  skill: string,
  _date?: string,
): Vendor[] {
  const matching: Vendor[] = [];
  vendors.forEach((v) => {
    if (v.skills.some((s) => s.toLowerCase() === skill.toLowerCase())) {
      matching.push(v);
    }
  });
  // Sort by average rating descending
  return matching.sort((a, b) => {
    const avgA =
      a.ratings.length > 0
        ? a.ratings.reduce((s, r) => s + r.score, 0) / a.ratings.length
        : 0;
    const avgB =
      b.ratings.length > 0
        ? b.ratings.reduce((s, r) => s + r.score, 0) / b.ratings.length
        : 0;
    return avgB - avgA;
  });
}

export function clearVendors(): void {
  vendors.clear();
}
