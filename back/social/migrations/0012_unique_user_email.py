from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('social', '0011_pendingsignup'),
    ]

    operations = [
        migrations.RunSQL(
            sql="CREATE UNIQUE INDEX unique_user_email ON auth_user(email) WHERE email != '';",
            reverse_sql="DROP INDEX unique_user_email;",
        ),
    ]