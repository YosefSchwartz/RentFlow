import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreateCommentDto {
  // Optional: a message may be attachment-only (see attachmentId below).
  // Service-level validation requires body OR attachmentId to be present.
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(2000)
  body?: string;

  // An attachment already uploaded via POST /requests/:id/attachments/upload
  // (with no commentId yet) that should be linked to this new message.
  @IsString()
  @IsOptional()
  attachmentId?: string;
}
