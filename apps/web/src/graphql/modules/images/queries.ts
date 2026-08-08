export const GET_UNASSIGNED_IMAGES = /* GraphQL */ `
  query GetUnassignedImages {
    unassignedImages {
      id
      originalFileName
      mimeType
      fileSize
      createdAt
      usageCount
    }
  }
`;