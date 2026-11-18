import { Category, MenuItem } from '../types/menu';

export interface CategoryHierarchy {
  mainCategories: Category[];
  subCategoriesByParent: Map<string, Category[]>;
  categoryById: Map<string, Category>;
  childIdsByParent: Map<string, string[]>;
}

/**
 * Splits a flat sorted list of categories into Main Categories (!parentId)
 * and Subcategories grouped by parentId. Any orphan subcategory whose parent
 * no longer exists is safely promoted into mainCategories so nothing disappears.
 */
export function buildCategoryHierarchy(categories: Category[]): CategoryHierarchy {
  const sorted = [...categories].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const categoryById = new Map<string, Category>();
  sorted.forEach((c) => categoryById.set(c.id, c));

  const mainCategories: Category[] = [];
  const subCategoriesByParent = new Map<string, Category[]>();
  const childIdsByParent = new Map<string, string[]>();

  sorted.forEach((cat) => {
    const cleanParentId = (cat.parentId || '').trim();
    if (cleanParentId && categoryById.has(cleanParentId) && cleanParentId !== cat.id) {
      const existingSubs = subCategoriesByParent.get(cleanParentId) || [];
      existingSubs.push(cat);
      subCategoriesByParent.set(cleanParentId, existingSubs);

      const existingIds = childIdsByParent.get(cleanParentId) || [];
      existingIds.push(cat.id);
      childIdsByParent.set(cleanParentId, existingIds);
    } else {
      mainCategories.push(cat);
    }
  });

  return {
    mainCategories,
    subCategoriesByParent,
    categoryById,
    childIdsByParent,
  };
}

/**
 * Checks whether a MenuItem matches the selected Main Category & Subcategory.
 */
export function doesItemMatchHierarchy(
  item: MenuItem,
  selectedMainCatId: string,
  selectedSubCatId: string,
  hierarchy: CategoryHierarchy
): boolean {
  if (selectedMainCatId === 'all') {
    return selectedSubCatId === 'all' || item.categoryId === selectedSubCatId;
  }

  if (selectedSubCatId !== 'all') {
    return item.categoryId === selectedSubCatId;
  }

  if (item.categoryId === selectedMainCatId) {
    return true;
  }

  const childIds = hierarchy.childIdsByParent.get(selectedMainCatId) || [];
  return childIds.includes(item.categoryId);
}
