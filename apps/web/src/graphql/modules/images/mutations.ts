export const DELETE_IMAGE = /* GraphQL */ `
  mutation DeleteImage($id: ID!, $correlationId: String!) {
    deleteImage(id: $id, correlationId: $correlationId) {
      __typename
      ... on DeleteImagePayload {
        success
      }
      ... on NotFoundError {
        message
      }
      ... on InternalError {
        message
      }
    }
  }
`;

export const UPDATE_IMAGE_ALBUM = /* GraphQL */ `
  mutation UpdateImageAlbum($id: ID!, $albumId: ID) {
    updateImageAlbum(id: $id, albumId: $albumId) {
      __typename
      ... on UpdateImageAlbumPayload {
        image {
          id
          originalFileName
          mimeType
          fileSize
          createdAt
          usageCount
        }
      }
      ... on ValidationError {
        message
      }
      ... on NotFoundError {
        message
      }
      ... on InternalError {
        message
      }
    }
  }
`;