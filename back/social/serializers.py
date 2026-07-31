from django.contrib.auth.models import User
from rest_framework import serializers
from .models import Post, PostMedia , Comment , Profile


class RegisterSerializer(serializers.ModelSerializer):

    class Meta:
        model = User
        fields = [
            "username",
            "first_name",
            "last_name",
            "password",
        ]
        extra_kwargs = {"password": {"write_only": True}}

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data["username"],
            first_name=validated_data["first_name"],
            last_name=validated_data["last_name"],
            password=validated_data["password"],
        )

        Profile.objects.create(user=user)

        return user



class PostMediaSerializer(serializers.ModelSerializer):
    # Simple serializer just to display media info in the response
    class Meta:
        model = PostMedia
        fields = ["id", "file", "media_type", "order"]


class PostSerializer(serializers.ModelSerializer):
    # Read-only nested list, filled automatically via related_name
    # (we'll make sure the model's related_name on PostMedia -> Post is "media")
    media = PostMediaSerializer(many=True, read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)

    # Reaction counters
    likes_count = serializers.SerializerMethodField()
    comments_count = serializers.SerializerMethodField()
    shares_count = serializers.SerializerMethodField()

    # Whether the currently logged-in user has liked / saved this post
    is_liked = serializers.SerializerMethodField()
    is_saved = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = ["id", "user",  "username" , "content", "media", "created_at" , "likes_count" , "comments_count" , "shares_count" , "is_liked" , "is_saved"]
        read_only_fields = ["user", "created_at"]
        extra_kwargs = {
            "content": {"required": False, "allow_blank": True}
        }

    def validate(self, data):
        # This only checks "content" itself (empty string allowed here).
        # The real "content OR files must exist" check happens in the View,
        # because uploaded files come from request.FILES, not from this data.
        return data

    def get_likes_count(self, obj):
        return obj.likes.count()

    def get_comments_count(self, obj):
        return obj.comments.count()

    def get_shares_count(self, obj):
        return obj.shares.count()

    def get_is_liked(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return obj.likes.filter(user=request.user).exists()

    def get_is_saved(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return obj.saved_by.filter(user=request.user).exists()

class CommentSerializer(serializers.ModelSerializer):
    # Expose the comment author's username directly (read-only)
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = Comment
        fields = ["id", "user", "username", "text", "created_at"]
        read_only_fields = ["user", "created_at"]



class ProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)

    posts_count = serializers.SerializerMethodField()
    shares_count = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = [
            "username",
            "first_name",
            "last_name",
            "bio",
            "profile_picture",
            "posts_count",
            "shares_count",
        ]

    def get_posts_count(self, obj):
        return obj.user.posts.count()

    def get_shares_count(self, obj):
        return obj.user.shares.count()