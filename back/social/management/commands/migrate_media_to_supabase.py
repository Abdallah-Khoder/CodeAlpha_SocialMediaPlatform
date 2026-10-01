import os
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.conf import settings

from social.models import Profile, PostMedia, StoryMedia, Message


class Command(BaseCommand):
    help = "Upload existing local media files to Supabase storage"

    def handle(self, *args, **options):
        local_media_root = settings.BASE_DIR / "media"

        fields_to_migrate = [
            (Profile, "profile_picture"),
            (PostMedia, "file"),
            (StoryMedia, "file"),
            (Message, "image"),
        ]

        total_uploaded = 0
        total_skipped = 0
        total_missing = 0

        for model, field_name in fields_to_migrate:
            self.stdout.write(f"\n--- Processing {model.__name__}.{field_name} ---")

            for obj in model.objects.all():
                field_file = getattr(obj, field_name)

                if not field_file:
                    continue

                local_path = local_media_root / field_file.name

                if not local_path.exists():
                    self.stdout.write(
                        self.style.WARNING(f"  Missing locally, skipping: {field_file.name}")
                    )
                    total_missing += 1
                    continue

                if field_file.storage.exists(field_file.name):
                    self.stdout.write(f"  Already on Supabase, skipping: {field_file.name}")
                    total_skipped += 1
                    continue

                with open(local_path, "rb") as f:
                    content = ContentFile(f.read())
                    field_file.storage.save(field_file.name, content)

                self.stdout.write(
                    self.style.SUCCESS(f"  Uploaded: {field_file.name}")
                )
                total_uploaded += 1

        self.stdout.write(self.style.SUCCESS(
            f"\nDone. Uploaded: {total_uploaded}, Already existed: {total_skipped}, Missing locally: {total_missing}"
        ))